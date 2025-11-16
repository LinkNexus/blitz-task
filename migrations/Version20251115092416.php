<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251115092416 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE task_task_label (task_id INT NOT NULL, task_label_id INT NOT NULL, PRIMARY KEY(task_id, task_label_id))');
        $this->addSql('CREATE INDEX IDX_D51000678DB60186 ON task_task_label (task_id)');
        $this->addSql('CREATE INDEX IDX_D51000677379C575 ON task_task_label (task_label_id)');
        $this->addSql('ALTER TABLE task_task_label ADD CONSTRAINT FK_D51000678DB60186 FOREIGN KEY (task_id) REFERENCES task (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE task_task_label ADD CONSTRAINT FK_D51000677379C575 FOREIGN KEY (task_label_id) REFERENCES task_label (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE task_task_label DROP CONSTRAINT FK_D51000678DB60186');
        $this->addSql('ALTER TABLE task_task_label DROP CONSTRAINT FK_D51000677379C575');
        $this->addSql('DROP TABLE task_task_label');
    }
}
