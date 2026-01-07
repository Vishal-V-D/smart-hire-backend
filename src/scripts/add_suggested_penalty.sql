-- Add suggestedPenalty to Secure Contest Results table
ALTER TABLE secure_contest_results 
ADD COLUMN "suggestedPenalty" FLOAT DEFAULT 0;
