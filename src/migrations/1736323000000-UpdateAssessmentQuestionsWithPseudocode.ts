import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAssessmentQuestionsWithPseudocode1736323000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('\n🔄 [MIGRATION] Updating assessment questions with pseudocode from question bank...\n');
        
        // Update questions in assessments that match questions in the question bank by text
        // This will copy pseudocode, division, subdivision, and topic from the question bank
        const result = await queryRunner.query(`
            UPDATE questions AS assessment_q
            SET 
                pseudocode = bank_q.pseudocode,
                division = COALESCE(assessment_q.division, bank_q.division),
                subdivision = COALESCE(assessment_q.subdivision, bank_q.subdivision),
                topic = COALESCE(assessment_q.topic, bank_q.topic)
            FROM questions AS bank_q
            WHERE 
                assessment_q.text = bank_q.text  -- Match by question text
                AND bank_q."sectionId" IS NULL  -- Question bank questions have null sectionId
                AND assessment_q."sectionId" IS NOT NULL  -- Assessment questions have sectionId
                AND bank_q.pseudocode IS NOT NULL  -- Only from questions that have pseudocode
                AND assessment_q.pseudocode IS NULL;  -- Only update null ones
        `);
        
        console.log(`✅ Updated ${result[1]} questions with pseudocode from question bank\n`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No need to revert - this is a data enhancement
        console.log('⏪ [MIGRATION] Rollback not needed for pseudocode update');
    }

}
