from transformers import pipeline
from rag.rag_pipeline import (
    load_docs,
    create_chunks,
    create_embeddings,
    create_vector_database,
    search,
)


class ThreatIntelligenceAgent:
    def __init__(self):
        # preparing rag
        text = load_docs()
        self.chunks = create_chunks(text)
        self.embedding_model, embeddings = create_embeddings(self.chunks)
        self.index = create_vector_database(embeddings)
        self.generator = pipeline(
            "text-generation",
            model="HuggingFaceTB/SmolLM2-360M-Instruct",
            device=-1,
        )

    # searching about the attack
    def investigate(self, attack_type):
        query = f"{attack_type} attack: behaviour, indicators, impact and defensive measures"
        documents = search(
            query, self.embedding_model, self.index, self.chunks, top_k=3
        )
        context = "\n\n".join(documents)

        # generate an answer grounded in retrieved information

        prompt = f"""You are a cybersecurity threat intelligence agent.

Predicted attack: {attack_type}

Retrieved knowledge:
{context}

Produce a concise report with these sections:

1. Attack overview
2. Indicators supported by the retrieved knowledge
3. Potential impact
4. Defensive recommendations
5. Information gaps

Rules:
- Use only facts supported by the retrieved knowledge.
- Do not invent indicators, impacts, or mitigations.
- If impact information is missing, say
  "Not specified in the retrieved knowledge."
- Distinguish a model prediction from a confirmed attack.
- Keep the report clear and concise.

Threat intelligence report:
"""
        response = self.generator(
            prompt, max_new_tokens=180, do_sample=False, return_full_text=False
        )
        analysis = response[0]["generated_text"].strip()

        # return json to next agent
        return {
            "agent": "Threat Intelligence Agent",
            "attack_type": attack_type,
            "retrieved_context": documents,
            "analysis": analysis,
            "status": "completed",
            "evidence_available": bool(documents),
        }

