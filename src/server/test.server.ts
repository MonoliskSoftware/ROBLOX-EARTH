import { GoogleTile } from "./google-tile";

const main = GoogleTile.createRoot(12).await()[1] as GoogleTile;

const BATTERY_PARK = [
	"214272517260526070",
	"214272516363515265"
];

const WHITE_HOUSE = [
	"2142706360716153515",
	"2142706360717042404"
];

const APARTMENT_BUILDING = [
	"2142725341505241627"
];

const BRIDGE_NEAR_WEST_SIDE_HIGHWAY = [
	"2142725341504371717"
];

const LGA = [
	"214272516373726161"
];

const JFK = [
	"214272517260526070"
];

const SCHOOL = [
	"2142725163726250635",
	"2142725163726250724"
];

const ROOSEVELT_ISLAND = [
	"2142725163727241537"
];

function test(k: string[]) {
	for (const id of k) main.search(id).await();
}

main.expandDescendants(13, 14).await();

// test(BATTERY_PARK);
// test(WHITE_HOUSE);
// test(SCHOOL);
test(JFK);
// test(APARTMENT_BUILDING);
// test(LGA);
// test(ROOSEVELT_ISLAND);
// test(BRIDGE_NEAR_WEST_SIDE_HIGHWAY);