from pathlib import Path
import pandas as pd
import numpy as np


# Input and output paths
INPUT_FILE = Path("data/processed/combined_dataset.csv")
OUTPUT_FILE = Path("data/processed/cleaned_dataset.csv")


# Number of rows processed at a time
CHUNK_SIZE = 50_000


def clean_label(label):
    """
    Clean and standardize CICIDS2017 attack labels.
    """

    if pd.isna(label):
        return np.nan

    label = str(label).strip()

    # Fix malformed Web Attack labels
    if "Web Attack" in label:
        if "Brute Force" in label:
            return "Web Attack - Brute Force"

        if "XSS" in label:
            return "Web Attack - XSS"

        if "Sql Injection" in label:
            return "Web Attack - Sql Injection"

    return label


def clean_dataset():

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}"
        )

    print("Starting dataset cleaning...")
    print(f"Input: {INPUT_FILE}")
    print(f"Output: {OUTPUT_FILE}")

    # Remove an old output file if it exists
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()

    first_chunk = True
    total_rows = 0
    total_duplicates = 0

    # Read the large dataset in chunks
    for chunk in pd.read_csv(
        INPUT_FILE,
        encoding="latin1",
        low_memory=False,
        chunksize=CHUNK_SIZE
    ):

        print(
            f"Processing rows "
            f"{total_rows:,} - "
            f"{total_rows + len(chunk):,}"
        )

        # --------------------------------------------------
        # 1. Clean column names
        # --------------------------------------------------

        chunk.columns = chunk.columns.str.strip()

        # --------------------------------------------------
        # 2. Clean labels
        # --------------------------------------------------

        if "Label" not in chunk.columns:
            raise ValueError(
                "Label column not found in dataset."
            )

        chunk["Label"] = chunk["Label"].apply(clean_label)

        # --------------------------------------------------
        # 3. Convert feature columns to numeric
        # --------------------------------------------------

        feature_columns = [
            column
            for column in chunk.columns
            if column != "Label"
        ]

        for column in feature_columns:
            chunk[column] = pd.to_numeric(
                chunk[column],
                errors="coerce"
            )

        # --------------------------------------------------
        # 4. Replace infinite values with NaN
        # --------------------------------------------------

        numeric_columns = chunk.select_dtypes(
            include="number"
        ).columns

        chunk[numeric_columns] = chunk[
            numeric_columns
        ].replace(
            [np.inf, -np.inf],
            np.nan
        )

        # --------------------------------------------------
        # 5. Remove rows without a label
        # --------------------------------------------------

        before_label_removal = len(chunk)

        chunk = chunk.dropna(
            subset=["Label"]
        )

        removed_labels = (
            before_label_removal - len(chunk)
        )

        if removed_labels > 0:
            print(
                f"Removed {removed_labels} rows "
                f"with missing labels."
            )

        # --------------------------------------------------
        # 6. Remove duplicate rows within the chunk
        # --------------------------------------------------

        before_duplicates = len(chunk)

        chunk = chunk.drop_duplicates()

        duplicates_removed = (
            before_duplicates - len(chunk)
        )

        total_duplicates += duplicates_removed

        # --------------------------------------------------
        # 7. Write cleaned chunk
        # --------------------------------------------------

        chunk.to_csv(
            OUTPUT_FILE,
            mode="w" if first_chunk else "a",
            header=first_chunk,
            index=False
        )

        first_chunk = False
        total_rows += len(chunk)

    print()
    print("Cleaning completed.")
    print(f"Rows written: {total_rows:,}")
    print(
        f"Duplicate rows removed within chunks: "
        f"{total_duplicates:,}"
    )
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    clean_dataset()
