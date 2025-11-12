<?php

namespace App\Entity;

use App\Repository\ProjectInvitationRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Uid\Ulid;

#[ORM\Entity(repositoryClass: ProjectInvitationRepository::class)]
class ProjectInvitation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['groups' => 'project_invitations:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['groups' => 'project_invitations:read'])]
    private ?string $guestEmail = null;

    #[ORM\ManyToOne(inversedBy: 'invitations')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Project $project = null;

    #[ORM\Column]
    #[Groups(['groups' => 'project_invitations:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: 'ulid')]
    private ?Ulid $identifier = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable;
        $this->identifier = new Ulid;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGuestEmail(): ?string
    {
        return $this->guestEmail;
    }

    public function setGuestEmail(string $guestEmail): static
    {
        $this->guestEmail = $guestEmail;

        return $this;
    }

    public function getProject(): ?Project
    {
        return $this->project;
    }

    public function setProject(?Project $project): static
    {
        $this->project = $project;

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getIdentifier(): ?Ulid
    {
        return $this->identifier;
    }

    public function setIdentifier(Ulid $identifier): static
    {
        $this->identifier = $identifier;

        return $this;
    }
}
