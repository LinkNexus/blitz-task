<?php

namespace App\Entity;

use App\Repository\ProjectRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ProjectRepository::class)]
class Project
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['projects:read', 'project:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['projects:read', 'project:read'])]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['project:read'])]
    private ?string $description = null;

    #[ORM\ManyToOne(inversedBy: 'createdProjects')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['project:read'])]
    private ?User $createdBy = null;

    /**
     * @var Collection<int, TaskColumn>
     */
    #[ORM\OneToMany(targetEntity: TaskColumn::class, mappedBy: 'project', orphanRemoval: true)]
    private Collection $columns;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['projects:read', 'project:read'])]
    private ?string $image = null;

    /**
     * @var Collection<int, User>
     */
    #[ORM\ManyToMany(targetEntity: User::class, inversedBy: 'projects')]
    #[Groups(['project:read'])]
    private Collection $participants;

    #[ORM\Column]
    #[Groups(['projects:read', 'project:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['projects:read', 'project:read'])]
    private ?string $icon = null;

    /**
     * @var Collection<int, ProjectInvitation>
     */
    #[ORM\OneToMany(targetEntity: ProjectInvitation::class, mappedBy: 'project', orphanRemoval: true)]
    private Collection $invitations;

    public function __construct()
    {
        $this->columns = new ArrayCollection;
        $this->participants = new ArrayCollection;
        $this->createdAt = new \DateTimeImmutable;
        $this->invitations = new ArrayCollection;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function setCreatedBy(?User $createdBy): static
    {
        $this->createdBy = $createdBy;

        return $this;
    }

    /**
     * @return Collection<int, TaskColumn>
     */
    public function getColumns(): Collection
    {
        return $this->columns;
    }

    public function addColumn(TaskColumn $column): static
    {
        if (! $this->columns->contains($column)) {
            $this->columns->add($column);
            $column->setProject($this);
        }

        return $this;
    }

    public function removeColumn(TaskColumn $column): static
    {
        if ($this->columns->removeElement($column)) {
            // set the owning side to null (unless already changed)
            if ($column->getProject() === $this) {
                $column->setProject(null);
            }
        }

        return $this;
    }

    public function getImage(): ?string
    {
        return $this->image;
    }

    public function setImage(?string $image): static
    {
        $this->image = $image;

        return $this;
    }

    /**
     * @return Collection<int, User>
     */
    public function getParticipants(): Collection
    {
        return $this->participants;
    }

    public function addParticipant(User $participant): static
    {
        if (! $this->participants->contains($participant)) {
            $this->participants->add($participant);
        }

        return $this;
    }

    public function removeParticipant(User $participant): static
    {
        $this->participants->removeElement($participant);

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

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): static
    {
        $this->icon = $icon;

        return $this;
    }

    /**
     * @return Collection<int, ProjectInvitation>
     */
    public function getInvitations(): Collection
    {
        return $this->invitations;
    }

    public function addInvitation(ProjectInvitation $invitation): static
    {
        if (!$this->invitations->contains($invitation)) {
            $this->invitations->add($invitation);
            $invitation->setProject($this);
        }

        return $this;
    }

    public function removeInvitation(ProjectInvitation $invitation): static
    {
        if ($this->invitations->removeElement($invitation)) {
            // set the owning side to null (unless already changed)
            if ($invitation->getProject() === $this) {
                $invitation->setProject(null);
            }
        }

        return $this;
    }
}
