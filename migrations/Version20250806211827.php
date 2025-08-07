<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250806211827 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE project (id SERIAL NOT NULL, team_id INT NOT NULL, name VARCHAR(255) NOT NULL, is_default BOOLEAN NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_2FB3D0EE296CD8AE ON project (team_id)');
        $this->addSql('CREATE TABLE task (id SERIAL NOT NULL, related_column_id INT NOT NULL, name VARCHAR(255) NOT NULL, description TEXT DEFAULT NULL, priority VARCHAR(255) NOT NULL, due_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, score DOUBLE PRECISION NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_527EDB25164FD2CE ON task (related_column_id)');
        $this->addSql('COMMENT ON COLUMN task.due_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN task.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE TABLE task_user (task_id INT NOT NULL, user_id INT NOT NULL, PRIMARY KEY(task_id, user_id))');
        $this->addSql('CREATE INDEX IDX_FE2042328DB60186 ON task_user (task_id)');
        $this->addSql('CREATE INDEX IDX_FE204232A76ED395 ON task_user (user_id)');
        $this->addSql('CREATE TABLE task_task_label (task_id INT NOT NULL, task_label_id INT NOT NULL, PRIMARY KEY(task_id, task_label_id))');
        $this->addSql('CREATE INDEX IDX_D51000678DB60186 ON task_task_label (task_id)');
        $this->addSql('CREATE INDEX IDX_D51000677379C575 ON task_task_label (task_label_id)');
        $this->addSql('CREATE TABLE task_column (id SERIAL NOT NULL, project_id INT NOT NULL, name VARCHAR(255) NOT NULL, color VARCHAR(255) NOT NULL, score DOUBLE PRECISION NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_46FA03AD166D1F9C ON task_column (project_id)');
        $this->addSql('CREATE TABLE task_label (id SERIAL NOT NULL, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE TABLE team (id SERIAL NOT NULL, name VARCHAR(255) NOT NULL, is_default BOOLEAN NOT NULL, PRIMARY KEY(id))');
        $this->addSql('ALTER TABLE project ADD CONSTRAINT FK_2FB3D0EE296CD8AE FOREIGN KEY (team_id) REFERENCES team (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task ADD CONSTRAINT FK_527EDB25164FD2CE FOREIGN KEY (related_column_id) REFERENCES task_column (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task_user ADD CONSTRAINT FK_FE2042328DB60186 FOREIGN KEY (task_id) REFERENCES task (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task_user ADD CONSTRAINT FK_FE204232A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task_task_label ADD CONSTRAINT FK_D51000678DB60186 FOREIGN KEY (task_id) REFERENCES task (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task_task_label ADD CONSTRAINT FK_D51000677379C575 FOREIGN KEY (task_label_id) REFERENCES task_label (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task_column ADD CONSTRAINT FK_46FA03AD166D1F9C FOREIGN KEY (project_id) REFERENCES project (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE project DROP CONSTRAINT FK_2FB3D0EE296CD8AE');
        $this->addSql('ALTER TABLE task DROP CONSTRAINT FK_527EDB25164FD2CE');
        $this->addSql('ALTER TABLE task_user DROP CONSTRAINT FK_FE2042328DB60186');
        $this->addSql('ALTER TABLE task_user DROP CONSTRAINT FK_FE204232A76ED395');
        $this->addSql('ALTER TABLE task_task_label DROP CONSTRAINT FK_D51000678DB60186');
        $this->addSql('ALTER TABLE task_task_label DROP CONSTRAINT FK_D51000677379C575');
        $this->addSql('ALTER TABLE task_column DROP CONSTRAINT FK_46FA03AD166D1F9C');
        $this->addSql('DROP TABLE project');
        $this->addSql('DROP TABLE task');
        $this->addSql('DROP TABLE task_user');
        $this->addSql('DROP TABLE task_task_label');
        $this->addSql('DROP TABLE task_column');
        $this->addSql('DROP TABLE task_label');
        $this->addSql('DROP TABLE team');
    }
}
