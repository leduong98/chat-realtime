import { MongoClient } from "mongodb";

let client;
let clientPromise;

function getUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  return uri;
}

if (process.env.NODE_ENV === "development") {
  if (!globalThis.__mongoClientPromise) {
    client = new MongoClient(getUri());
    globalThis.__mongoClientPromise = client.connect();
  }
  clientPromise = globalThis.__mongoClientPromise;
} else {
  client = new MongoClient(getUri());
  clientPromise = client.connect();
}

export async function getDb() {
  const c = await clientPromise;
  return c.db(process.env.MONGODB_DB || "pi-chat");
}

