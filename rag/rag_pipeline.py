import re
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent / "data" / "cybersecurity.txt"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 120
DEFAULT_TOP_K = 3

def load_docs():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return f.read()

def create_chunks(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """ Split the knowledge base into smaller, meaningful chunks."""
    if not text or not text.strip():
        return []

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Split at numbered section headings, even when the document
    # does not contain blank lines between paragraphs.
    sections = re.split(r"(?m)(?=^\s*\d+(?:\.\d+)*\.?\s+)", text)

    chunks = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        if len(section) <= chunk_size:
            chunks.append(section)
            continue

        # Split long sections by lines, then pack them into chunks.
        lines = [line.strip() for line in section.split("\n") if line.strip()]
        current = ""
        for line in lines:
            # Handle an unusually long individual line.
            if len(line) > chunk_size:
                if current:
                    chunks.append(current)
                    current = ""

                start = 0
                while start < len(line):
                    end = start + chunk_size
                    piece = line[start:end].strip()

                    if piece:
                        chunks.append(piece)

                    start = end - overlap

                continue

            candidate = f"{current}\n{line}".strip() if current else line

            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    chunks.append(current)

                # Carry a small overlap from the previous chunk.
                overlap_text = current[-overlap:] if current else ""
                current = f"{overlap_text}\n{line}".strip()

        if current:
            chunks.append(current)

    return chunks


def create_embeddings(chunks):
    if not chunks:
        raise ValueError("Cannot create embeddings: no chunks found.")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(chunks, convert_to_numpy=True, normalize_embeddings=True)

    return model, embeddings


def create_vector_database(embeddings):
    embeddings = np.asarray(embeddings, dtype="float32")

    if embeddings.ndim != 2 or len(embeddings) == 0:
        raise ValueError("Invalid or empty embeddings.")

    dimension = embeddings.shape[1]

    # Cosine similarity using normalized embeddings.
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    return index


def search(query, model, index, chunks, top_k=DEFAULT_TOP_K):
    if not query or not chunks:
        return []

    query_embedding = model.encode(
        [query], convert_to_numpy=True, normalize_embeddings=True
    ).astype("float32")

    k = min(max(1, int(top_k)), len(chunks))

    scores, indices = index.search(query_embedding, k)

    results = []

    for score, idx in zip(scores[0], indices[0]):
        if 0 <= idx < len(chunks):
            results.append({"text": chunks[idx], "score": float(score)})

    return results


def main():
    print("\nLoading cybersecurity knowledge base...")

    text = load_docs()
    chunks = create_chunks(text)

    print("Total characters:", len(text))
    print("Number of chunks:", len(chunks))

    for i, chunk in enumerate(chunks):
        print(f"Chunk {i + 1}: {len(chunk)} characters")

    print("\nCreating embeddings...")
    model, embeddings = create_embeddings(chunks)

    print("Creating vector database...")
    index = create_vector_database(embeddings)

    print("\nRAG system is ready!")

    while True:
        query = input("\nAsk a cybersecurity question: ")

        if query.lower() == "exit":
            break

        results = search(query, model, index, chunks)

        for i, result in enumerate(results, 1):
            print(f"\nResult {i} (score: {result['score']:.3f})")
            print(result["text"])


if __name__ == "__main__":
    main()
