// Facts about the school and the fixed lists the forms use.
export const SCHOOL = { short: 'NHS', name: 'Nimsar High School', est: 1958, city: 'Comilla', eiin: '105270', email: 'nhs.alumnus@gmail.com', fbGroup: 'https://www.facebook.com/groups/nhsalumni.org' };
export const FOUNDED = SCHOOL.est;
// A batch is the year its students passed the SSC exam (passed SSC in 2014 = Batch 2014).
export const THIS_YEAR = new Date().getFullYear();
/** From 2022, profiles added from the board's result sheets have no name: their form opens only for their own SSC roll. */
export const ROLL_CHECK_FROM = 2022;

export const GROUPS = [
  { name: 'Science', cls: 'g-science' },
  { name: 'Business Studies', cls: 'g-business' },
  { name: 'Humanities', cls: 'g-humanities' },
];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const SEXES = { MALE: 'Male', FEMALE: 'Female' };
