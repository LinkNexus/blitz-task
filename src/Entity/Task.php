<?php

namespace App\Entity;

use App\Enum\TaskPriority;
use App\Repository\TaskRepository;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: TaskRepository::class)]
class Task
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['task:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['task:read'])]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['task:read'])]
    private ?string $description = null;

    /**
     * @var Collection<int, User>
     */
    #[ORM\ManyToMany(targetEntity: User::class)]
    #[Groups(['task:read'])]
    private Collection $assignees;

    #[ORM\Column(nullable: true)]
    #[Groups(['task:read'])]
    private ?DateTimeImmutable $dueAt = null;

    #[ORM\Column]
    #[Groups(['task:read'])]
    private ?DateTimeImmutable $createdAt = null;

    #[ORM\ManyToOne(inversedBy: 'tasks')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['task:read'])]
    private ?TaskColumn $relatedColumn = null;

    #[ORM\Column(enumType: TaskPriority::class)]
    #[Groups(['task:read'])]
    private ?TaskPriority $priority = null;

    /**
     * @var Collection<int, TaskTag>
     */
    #[ORM\ManyToMany(targetEntity: TaskTag::class, inversedBy: 'tasks')]
    #[Groups(['task:read'])]
    private Collection $tags;

    #[ORM\Column]
    private ?float $score = null;

    public function __construct()
    {
        $this->assignees = new ArrayCollection;
        $this->createdAt = new DateTimeImmutable;
        $this->priority = TaskPriority::MEDIUM;
        $this->tags = new ArrayCollection;
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

    /**
     * @return Collection<int, User>
     */
    public function getAssignees(): Collection
    {
        return $this->assignees;
    }

    public function addAssignee(User $assignee): static
    {
        if (!$this->assignees->contains($assignee)) {
            $this->assignees->add($assignee);
        }

        return $this;
    }

    public function removeAssignee(User $assignee): static
    {
        $this->assignees->removeElement($assignee);

        return $this;
    }

    public function getDueAt(): ?DateTimeImmutable
    {
        return $this->dueAt;
    }

    public function setDueAt(?DateTimeImmutable $dueAt): static
    {
        $this->dueAt = $dueAt;

        return $this;
    }

    public function getCreatedAt(): ?DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getRelatedColumn(): ?TaskColumn
    {
        return $this->relatedColumn;
    }

    public function setRelatedColumn(?TaskColumn $relatedColumn): static
    {
        $this->relatedColumn = $relatedColumn;

        return $this;
    }

    public function getPriority(): ?TaskPriority
    {
        return $this->priority;
    }

    public function setPriority(TaskPriority $priority): static
    {
        $this->priority = $priority;

        return $this;
    }

    /**
     * @return Collection<int, TaskTag>
     */
    public function getTags(): Collection
    {
        return $this->tags;
    }

    public function addTag(TaskTag $label): static
    {
        if (!$this->tags->contains($label)) {
            $this->tags->add($label);
        }

        return $this;
    }

    public function removeTag(TaskTag $label): static
    {
        $this->tags->removeElement($label);

        return $this;
    }

    public function getScore(): ?float
    {
        return $this->score;
    }

    public function setScore(float $score): static
    {
        $this->score = $score;

        return $this;
    }
}
