<?php

namespace App\Entity;

use App\Repository\TaskTagRepository;
use App\Validator\UniqueEntityValue;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: TaskTagRepository::class)]
class TaskTag
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['task:read', "tags:read"])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['task:read', "tags:read"])]
    #[Assert\NotBlank(message: "The name field cannot be empty.", normalizer: "trim")]
    #[Assert\Length(min: 2, max: 255, minMessage: "The name must be at least {{ limit }} characters long.", maxMessage: "The name cannot be longer than {{ limit }} characters.")]
    #[UniqueEntityValue('name', entityClass: self::class, message: 'This label already exists')]
    private ?string $name = null;

    #[ORM\Column(length: 255)]
    private ?string $slug = null;

    /**
     * @var Collection<int, Task>
     */
    #[ORM\ManyToMany(targetEntity: Task::class, mappedBy: 'tags')]
    private Collection $tasks;

    public function __construct()
    {
        $this->tasks = new ArrayCollection;
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

    public function getSlug(): ?string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): static
    {
        $this->slug = $slug;

        return $this;
    }

    /**
     * @return Collection<int, Task>
     */
    public function getTasks(): Collection
    {
        return $this->tasks;
    }

    public function addTask(Task $task): static
    {
        if (!$this->tasks->contains($task)) {
            $this->tasks->add($task);
            $task->addTag($this);
        }

        return $this;
    }

    public function removeTask(Task $task): static
    {
        if ($this->tasks->removeElement($task)) {
            $task->removeTag($this);
        }

        return $this;
    }
}
