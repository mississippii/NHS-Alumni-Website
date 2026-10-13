/** Event details as typed: plain lines, and runs of "a | b | c" lines as a table (first line = header), e.g. a T-shirt size chart. */
export function EventDetails({ text }) {
  const blocks = [];
  for (const line of text.split('\n')) {
    const isRow = line.includes('|'), last = blocks.at(-1);
    if (isRow && last?.rows) last.rows.push(line.split('|').map(c => c.trim()));
    else if (isRow) blocks.push({ rows: [line.split('|').map(c => c.trim())] });
    else if (last && !last.rows) last.text += '\n' + line;
    else blocks.push({ text: line });
  }
  return (
    <div className="event-details">
      {blocks.map((b, i) => (b.rows ? (
        <div className="table-scroll" key={i}>
          <table className="size-table">
            <thead><tr>{b.rows[0].map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
            <tbody>{b.rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : b.text.trim() && <p key={i}>{b.text.trim()}</p>))}
    </div>
  );
}
