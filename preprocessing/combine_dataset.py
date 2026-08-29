from pathlib import Path
import pandas as pd


# Project directories
RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")

# Output file
OUTPUT_FILE = PROCESSED_DIR / "combined_dataset.csv"


def combine_datasets():
    """
    Combine all CICIDS2017 CSV files from data/raw/
    into a single CSV file.
    """

    # Find all CSV files
    csv_files = sorted(RAW_DIR.glob("*.csv"))

    if not csv_files:
        raise FileNotFoundError(
            "No CSV files found in data/raw/"
        )

    print(f"Found {len(csv_files)} CSV files.")

    # Make sure output directory exists
    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    first_file = True

    # Process one file at a time
    for csv_file in csv_files:

        print(f"Processing: {csv_file.name}")

        for chunk in pd.read_csv(
            csv_file,
            encoding="latin1",
            low_memory=False,
            chunksize=50_000
        ):

            # Remove whitespace from column names
            chunk.columns = chunk.columns.str.strip()

            # Write header only for the first chunk
            chunk.to_csv(
                OUTPUT_FILE,
                mode="w" if first_file else "a",
                header=first_file,
                index=False
            )

            first_file = False

    print()
    print("Dataset combination completed.")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    combine_datasets()