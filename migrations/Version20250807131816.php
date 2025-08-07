<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250807131816 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE team_admins (team_id INT NOT NULL, user_id INT NOT NULL, PRIMARY KEY(team_id, user_id))');
        $this->addSql('CREATE INDEX IDX_D4FB52D6296CD8AE ON team_admins (team_id)');
        $this->addSql('CREATE INDEX IDX_D4FB52D6A76ED395 ON team_admins (user_id)');
        $this->addSql('ALTER TABLE team_admins ADD CONSTRAINT FK_D4FB52D6296CD8AE FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE team_admins ADD CONSTRAINT FK_D4FB52D6A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE team ADD creator_id INT NOT NULL');
        $this->addSql('ALTER TABLE team ADD CONSTRAINT FK_C4E0A61F61220EA6 FOREIGN KEY (creator_id) REFERENCES "user" (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_C4E0A61F61220EA6 ON team (creator_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('ALTER TABLE team_admins DROP CONSTRAINT FK_D4FB52D6296CD8AE');
        $this->addSql('ALTER TABLE team_admins DROP CONSTRAINT FK_D4FB52D6A76ED395');
        $this->addSql('DROP TABLE team_admins');
        $this->addSql('ALTER TABLE team DROP CONSTRAINT FK_C4E0A61F61220EA6');
        $this->addSql('DROP INDEX IDX_C4E0A61F61220EA6');
        $this->addSql('ALTER TABLE team DROP creator_id');
    }
}
