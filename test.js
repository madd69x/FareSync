async function test() {
  const response = await fetch(`https://photon.komoot.io/reverse?lon=-74.006&lat=40.7127`);
  const data = await response.json();
  console.log(data.features[0].properties);
}
test();
