async function test() {
  const res = await fetch('http://localhost:3000');
  const html = await res.text();
  const specialIdx = html.indexOf('special-sponsors');
  const goldIdx = html.indexOf('gold-sponsors');
  console.log('Special sponsors index:', specialIdx);
  if (specialIdx !== -1) {
    console.log(html.slice(specialIdx, goldIdx > specialIdx ? goldIdx : specialIdx + 1500));
  }
}
test();
