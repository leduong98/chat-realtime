import { MongoClient } from "mongodb";

function getUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  return uri;
}

function getClientPromise() {
  if (process.env.NODE_ENV === "development") {
    if (!globalThis.__mongoClientPromise) {
      const client = new MongoClient(getUri());
      globalThis.__mongoClientPromise = client.connect();
    }
    return globalThis.__mongoClientPromise;
  }
  if (!globalThis.__mongoClientPromise_prod) {
    const client = new MongoClient(getUri());
    globalThis.__mongoClientPromise_prod = client.connect();
  }
  return globalThis.__mongoClientPromise_prod;
}

export async function getDb() {
  const c = await getClientPromise();
  return c.db(process.env.MONGODB_DB || "pi-chat");
}

