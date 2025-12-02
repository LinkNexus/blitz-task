<?php

namespace App\DTO;

use App\Entity\Project;
use Symfony\Component\ObjectMapper\Attribute\Map;
use Symfony\Component\Validator\Constraints as Assert;

#[Map(target: Project::class)]
final class ProjectDTO
{
    #[Assert\NotNull(message: 'The name field cannot be null.')]
    #[Assert\NotBlank(message: 'The name field cannot be empty.', allowNull: true, normalizer: 'trim')]
    #[Assert\Length(min: 2, max: 255, minMessage: 'The name must be at least {{ limit }} characters long.', maxMessage: 'The name cannot be longer than {{ limit }} characters.', groups: ['create', 'update'])]
    #[Assert\Regex(pattern: '/^[a-zA-Z0-9_ ]+$/', message: 'The name can only contain alphanumeric characters, spaces and underscores.', groups: ['create', 'update'])]
    public ?string $name = null;

    public string $description = '';

    #[Assert\NotBlank(message: 'The icon field cannot be empty.', allowNull: true, normalizer: 'trim')]
    #[Assert\Length(max: 255, maxMessage: 'The icon path cannot be longer than {{ limit }} characters.')]
    public ?string $icon = null;
}
