-- Safe to re-run. Existing AO3 URLs are classified only when the column is first added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fics' AND column_name='source_type'
  ) THEN
    ALTER TABLE public.fics ADD COLUMN source_type text NOT NULL DEFAULT 'unsorted';
    UPDATE public.fics
      SET source_type='ao3'
      WHERE source_url ~* '^https?://(www\.)?archiveofourown\.org/works/[0-9]+';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fics_source_type_check'
      AND conrelid='public.fics'::regclass
  ) THEN
    ALTER TABLE public.fics ADD CONSTRAINT fics_source_type_check
      CHECK (source_type IN ('ao3','unsorted'));
  END IF;
END $$;
