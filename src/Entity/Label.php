<?php

namespace App\Entity;

use App\Repository\LabelRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: LabelRepository::class)]
class Label
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(["columns:read", "tasks:read"])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(["columns:read", "tasks:read"])]
    #[Assert\NotBlank(message: "The name field cannot be empty.", normalizer: "trim")]
    #[Assert\Length(min: 2, max: 255, minMessage: "The name must be at least {{ limit }} characters long.", maxMessage: "The name cannot be longer than {{ limit }} characters.")]
    private ?string $name = null;

    #[ORM\Column(length: 255, unique: true)]
    private ?string $slug = null;

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
}
