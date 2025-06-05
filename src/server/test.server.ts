import { GoogleTile } from "./google-tile";

const test = GoogleTile.createRoot().await()[1] as GoogleTile;

test.search("2142725");