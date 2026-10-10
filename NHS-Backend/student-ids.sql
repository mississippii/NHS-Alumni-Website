-- One-off: renumber alumni from 1, 2, 3… to student IDs (YYDDSSS, see AlumnusRepository.nextId).
-- Serials follow the SSC roll order within each batch + department, except the students in "pins", who get the ID
-- given there (the rest of their group skips that serial). Run once per database, with the backend stopped:
--   mysql -u veer -p NHS_Alumni < student-ids.sql
-- Then rename uploads/photos/<old_id>.jpg to <new_id>.jpg for each row the last SELECT prints.
-- Any error (e.g. a duplicate ID) stops the script and nothing is changed.

START TRANSACTION;

CREATE TEMPORARY TABLE id_map AS
WITH pins (old_id, new_id) AS (
    SELECT 535, 1403005      -- Tanvir Hasan, 2014 Science
    UNION ALL SELECT 450, 1303005  -- Naima Jahan, 2013 Science
), numbered AS (
    SELECT id,
           batch % 100 * 100000
               + CASE department WHEN 'Humanities' THEN 1 WHEN 'Business Studies' THEN 2 WHEN 'Science' THEN 3 END * 1000 AS base,
           ROW_NUMBER() OVER (PARTITION BY batch, department ORDER BY roll IS NULL, roll, id) AS n
    FROM alumnus
    WHERE id NOT IN (SELECT old_id FROM pins)
)
-- ponytail: skipping works for one pin per group; two pins in a group with adjacent serials would collide (and abort).
SELECT id AS old_id, base + n + (SELECT COUNT(*) FROM pins WHERE new_id BETWEEN base + 1 AND base + n) AS new_id FROM numbered
UNION ALL
SELECT old_id, new_id FROM pins;

SET FOREIGN_KEY_CHECKS = 0;
UPDATE education x JOIN id_map m ON x.alumnus_id = m.old_id SET x.alumnus_id = m.new_id;
UPDATE job x JOIN id_map m ON x.alumnus_id = m.old_id SET x.alumnus_id = m.new_id;
UPDATE social_link x JOIN id_map m ON x.alumnus_id = m.old_id SET x.alumnus_id = m.new_id;
UPDATE alumnus a JOIN id_map m ON a.id = m.old_id
SET a.id = m.new_id,
    a.photo_url = REPLACE(a.photo_url, CONCAT('/api/photos/', m.old_id, '.jpg'), CONCAT('/api/photos/', m.new_id, '.jpg'));
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

SELECT m.old_id, m.new_id FROM id_map m JOIN alumnus a ON a.id = m.new_id WHERE a.photo_url IS NOT NULL;
