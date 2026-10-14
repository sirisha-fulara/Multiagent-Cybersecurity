from transformers import pipeline
from rag.rag_pipeline import (
    load_docs,
    create_chunks,
    create_embeddings,
    create_vector_database,
    search,
)


class ThreatIntelligenceAgent:
    """Retrieve cybersecurity knowledge and generate a threat report."""

    def __init__(self):
        print("Initializing Threat Intelligence Agent...")

        # loading knowledge base
        text = load_docs()
        if not text:
            raise ValueError("No cybersecurity documents were loaded.")

        # chunking
        self.chunks = create_chunks(text)
        if not self.chunks:
            raise ValueError("No text chunks were created from the documents.")

        # Sembeddings
        self.embedding_model, embeddings = create_embeddings(self.chunks)

        # vector db
        self.index = create_vector_database(embeddings)

        # load the small language model.
        self.generator = pipeline(
            "text-generation",
            model="HuggingFaceTB/SmolLM2-360M-Instruct",
            device=-1,
        )

        print("Threat Intelligence Agent initialized.")

    def investigate(self, attack_type):
        """Investigate a predicted attack and return a report."""

        if not attack_type:
            raise ValueError("Attack type cannot be empty.")

        # searching for info from kb
        query = (
            f"{attack_type} attack: behaviour, indicators, "
            "impact and defensive measures"
        )

        documents = search(
            query,
            self.embedding_model,
            self.index,
            self.chunks,
            top_k=3,
        )

        # handle cases where no knowledge was retrieved.
        if not documents:
            return {
                "agent": "Threat Intelligence Agent",
                "attack_type": attack_type,
                "retrieved_context": [],
                "analysis": (
                    "No relevant information was retrieved. "
                    "The attack prediction could not be "
                    "independently verified."
                ),
                "status": "completed",
                "evidence_available": False,
            }

        # preparing retreived knowledge
        context = "\n\n".join(str(document) for document in documents)
        prompt = f"""You are a cybersecurity threat intelligence agent.

Predicted attack: {attack_type}

Retrieved knowledge:
{context}

Write a concise report with these sections:

1. Attack overview
2. Indicators supported by the retrieved knowledge
3. Potential impact
4. Defensive recommendations
5. Information gaps

Rules:
- Use only facts supported by the retrieved knowledge.
- Do not invent indicators, impacts, or mitigations.
- If information is missing, state that it is not specified
  in the retrieved knowledge.
- Distinguish a model prediction from a confirmed attack.
- Keep the report clear and concise.

Threat intelligence report:
"""

        # generate the report.
        response = self.generator(
            prompt,
            max_new_tokens=140,
            do_sample=False,
            return_full_text=False,
            repetition_penalty=1.2,
            no_repeat_ngram_size=4,
            pad_token_id=self.generator.tokenizer.eos_token_id,
        )

        analysis = response[0]["generated_text"].strip()

        # return a structured result to the coordinator.
        return {
            "agent": "Threat Intelligence Agent",
            "attack_type": attack_type,
            "retrieved_context": documents,
            "analysis": analysis,
            "status": "completed",
            "evidence_available": True,
        }


if __name__ == "__main__":
    agent = ThreatIntelligenceAgent()
    report = agent.investigate("DDoS")

    print("\nThreat Intelligence Report")
    print("--------------------------")
    print(report["analysis"])
