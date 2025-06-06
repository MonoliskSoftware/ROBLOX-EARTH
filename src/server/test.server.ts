import { GoogleTile } from "./google-tile";

const test = GoogleTile.createRoot(10).await()[1] as GoogleTile;

// test.search("2142725");
test.search("214272517260526070");