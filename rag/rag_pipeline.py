import os
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path

# loading knowledge base
DATA_FILE = Path(__file__).resolve().parent / "data" / "cybersecurity.txt"


def load_docs():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        text = f.read()
    return text


# split text into chunks
def create_chunks(text):
    chunks = text.split("\n\n")
    chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
    return chunks


# creating embeddings
# Similar meanings produce vectors that are relatively close to each other.
def create_embeddings(chunks):
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(chunks, convert_to_numpy=True)
    return model, embeddings


# create faiss db
def create_vector_database(embeddings):
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(
        dimension
    )  # performs a similarity search using L2 distance (Euclidean distance)
    index.add(
        np.array(embeddings).astype("float32")
    )  # puts all embeddings into the FAISS index.
    return index


# searching
def search(query, model, index, chunks, top_k=5):
    query_embedding = model.encode([query], convert_to_numpy=True)
    distances, indices = index.search(
        np.array(query_embedding).astype("float32"), top_k
    )  # faiss returns distance and indices of results

    results = []
    for i in indices[0]:
        if 0 <= i < len(chunks):
            results.append(chunks[i])
    return results


def main():
    print("\nLoading cybersecurity knowledge base...")
    text = load_docs()

    chunks = create_chunks(text)
    print("Number of chunks:", len(chunks))

    print("\nCreating embeddings...")
    model, embeddings = create_embeddings(chunks)

    print("Creating vector database...")
    index = create_vector_database(embeddings)

    print("RAG system is ready!")
    while True:
        query = input("\nAsk a cybersecurity question " "(type 'exit' to stop): ")
        if query.lower() == "exit":
            break

        results = search(query, model, index, chunks)

        print("\nRelevant information:\n")
        for i, result in enumerate(results, 1):
            print(f"Result {i}")
            print(result)
            print()


if __name__ == "__main__":
    main()
