from pathlib import Path
import pandas as pd
import numpy as np

INPUT_FILE = Path("data/processed/cleaned_dataset.csv")
OUTPUT_FILE = Path("data/processed/sampled_dataset.csv")

CHUNK_SIZE = 50_000
RANDOM_STATE = 42

BENIGN_LABEL = "BENIGN"
BENIGN_TARGET = 25_000
THREAT_TARGET = 25_000

# Attack classes with very few samples will be kept completely.
RARE_THRESHOLD = 100

# Every non-rare attack class will get at least this many samples.
MIN_PER_ATTACK = 500


def count_labels():
    """Count the number of rows belonging to each label."""

    print("=" * 60)
    print("STEP 1: Counting labels")
    print("=" * 60)

    label_counts = {}

    for chunk_number, chunk in enumerate(
        pd.read_csv(
            INPUT_FILE,
            encoding="latin1",
            low_memory=False,
            chunksize=CHUNK_SIZE
        ),
        start=1
    ):
        chunk.columns = chunk.columns.str.strip()

        counts = chunk["Label"].value_counts()

        for label, count in counts.items():
            label_counts[label] = label_counts.get(label, 0) + int(count)

        print(f"Processed chunk {chunk_number}...")

    counts = pd.Series(label_counts).sort_values(ascending=False)

    print("\nLabel distribution:")
    print(counts.to_string())

    return counts


def calculate_attack_quotas(label_counts):
    """
    Decide how many rows to sample from each attack class.

    Rare attacks are kept completely.
    Other attack classes receive at least MIN_PER_ATTACK
    and the remaining slots are distributed proportionally.
    """

    attack_counts = label_counts.drop(labels=[BENIGN_LABEL], errors="ignore")

    quotas = {}

    # Keep rare attack classes completely.
    rare_labels = [
        label
        for label, count in attack_counts.items()
        if count <= RARE_THRESHOLD
    ]

    rare_total = 0

    for label in rare_labels:
        quotas[label] = int(attack_counts[label])
        rare_total += int(attack_counts[label])

    remaining_labels = [
        label
        for label in attack_counts.index
        if label not in rare_labels
    ]

    remaining_slots = THREAT_TARGET - rare_total

    if remaining_slots < 0:
        raise ValueError(
            "Rare attack classes alone contain more than 25,000 rows."
        )

    # Give every non-rare class a minimum number first.
    minimum_total = sum(
        min(MIN_PER_ATTACK, int(attack_counts[label]))
        for label in remaining_labels
    )

    if minimum_total > remaining_slots:
        raise ValueError(
            "MIN_PER_ATTACK is too large for the available threat samples."
        )

    for label in remaining_labels:
        quotas[label] = min(
            MIN_PER_ATTACK,
            int(attack_counts[label])
        )

    remaining_slots -= minimum_total

    # Distribute remaining samples proportionally.
    if remaining_slots > 0 and remaining_labels:

        available_counts = np.array(
            [attack_counts[label] for label in remaining_labels],
            dtype=float
        )

        weights = available_counts / available_counts.sum()

        raw_extra = weights * remaining_slots
        extra = np.floor(raw_extra).astype(int)

        for label, amount in zip(remaining_labels, extra):
            quotas[label] += int(amount)

        leftover = remaining_slots - int(extra.sum())

        fractions = raw_extra - extra
        order = np.argsort(-fractions)

        for index in order[:leftover]:
            label = remaining_labels[index]

            if quotas[label] < attack_counts[label]:
                quotas[label] += 1

    # Safety check.
    total_threat_quota = sum(quotas.values())

    if total_threat_quota != THREAT_TARGET:
        raise ValueError(
            f"Threat quota is {total_threat_quota}, "
            f"but should be {THREAT_TARGET}."
        )

    return quotas


def sample_rows(label_quotas):
    """
    Randomly sample the required number of rows from every label.

    Sampling is performed using random scores so that we never
    need to keep the complete 877 MB dataset in memory.
    """

    print()
    print("=" * 60)
    print("STEP 2: Random sampling")
    print("=" * 60)

    rng = np.random.default_rng(RANDOM_STATE)

    # Add BENIGN to the sampling quotas first.
    all_quotas = dict(label_quotas)
    all_quotas[BENIGN_LABEL] = BENIGN_TARGET

    reservoirs = {
        label: pd.DataFrame()
        for label in all_quotas
    }

    for chunk_number, chunk in enumerate(
        pd.read_csv(
            INPUT_FILE,
            encoding="latin1",
            low_memory=False,
            chunksize=CHUNK_SIZE
        ),
        start=1
    ):
        chunk.columns = chunk.columns.str.strip()

        for label, quota in all_quotas.items():

            if quota == 0:
                continue

            rows = chunk[chunk["Label"] == label]

            if rows.empty:
                continue

            rows = rows.copy()

            # Assign each row a random score.
            rows["_random_score"] = rng.random(len(rows))

            if reservoirs[label].empty:
                combined = rows
            else:
                combined = pd.concat(
                    [reservoirs[label], rows],
                    ignore_index=True
                )

            # Keep only the rows with the highest random scores.
            reservoirs[label] = combined.nlargest(
                quota,
                "_random_score"
            )

        print(f"Processed chunk {chunk_number}...")

    sampled_parts = []

    for label, quota in all_quotas.items():

        result = reservoirs[label]

        if len(result) < quota:
            raise ValueError(
                f"Not enough rows for label '{label}'. "
                f"Needed {quota}, found {len(result)}."
            )

        result = result.drop(columns=["_random_score"])

        sampled_parts.append(result)

    sampled = pd.concat(
        sampled_parts,
        ignore_index=True
    )

    return sampled


def verify_dataset(sampled):
    """Verify that the final dataset has exactly 50,000 rows."""

    print()
    print("=" * 60)
    print("STEP 3: Verifying sampled dataset")
    print("=" * 60)

    sampled["Target"] = (
        sampled["Label"] != BENIGN_LABEL
    ).astype("int8")

    # Shuffle the final dataset.
    sampled = sampled.sample(
        frac=1,
        random_state=RANDOM_STATE
    ).reset_index(drop=True)

    total_rows = len(sampled)
    benign_rows = int((sampled["Target"] == 0).sum())
    threat_rows = int((sampled["Target"] == 1).sum())

    print(f"Total rows:     {total_rows}")
    print(f"BENIGN rows:    {benign_rows}")
    print(f"THREAT rows:    {threat_rows}")

    if total_rows != 50_000:
        raise ValueError(
            f"Expected 50,000 rows but got {total_rows}."
        )

    if benign_rows != BENIGN_TARGET:
        raise ValueError(
            f"Expected 25,000 BENIGN rows but got {benign_rows}."
        )

    if threat_rows != THREAT_TARGET:
        raise ValueError(
            f"Expected 25,000 THREAT rows but got {threat_rows}."
        )

    if sampled["Label"].isna().any():
        raise ValueError("Found missing labels.")

    print("\nAttack distribution:")
    print(
        sampled[sampled["Target"] == 1]["Label"]
        .value_counts()
        .to_string()
    )

    return sampled


def main():

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input dataset not found: {INPUT_FILE}"
        )

    print("Starting dataset sampling...")
    print(f"Input:  {INPUT_FILE}")
    print(f"Output: {OUTPUT_FILE}")

    # First pass: count labels.
    label_counts = count_labels()

    # Calculate threat quotas.
    attack_quotas = calculate_attack_quotas(label_counts)

    print()
    print("=" * 60)
    print("THREAT SAMPLING QUOTAS")
    print("=" * 60)

    for label, quota in attack_quotas.items():
        print(f"{label}: {quota}")

    print(f"\nTotal threat samples: {sum(attack_quotas.values())}")
    print(f"Total benign samples: {BENIGN_TARGET}")

    # Second pass: perform sampling.
    sampled = sample_rows(attack_quotas)

    # Verify and add Target.
    sampled = verify_dataset(sampled)

    # Save final dataset.
    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    sampled.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print()
    print("=" * 60)
    print("SAMPLING COMPLETED")
    print("=" * 60)

    print(f"Saved to: {OUTPUT_FILE}")
    print(f"Rows:     {len(sampled):,}")
    print(f"Columns:  {len(sampled.columns)}")


if __name__ == "__main__":
    main()
