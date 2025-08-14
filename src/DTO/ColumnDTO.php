<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class ColumnDTO
{
    #[Assert\Length(min: 2, max: 255, minMessage: "The name must be at least {{ limit }} characters long.", maxMessage: "The name cannot be longer than {{ limit }} characters.")]
    #[Assert\NotBlank(message: "The name field cannot be empty.", normalizer: "trim")]
    public ?string $name = null;

    #[Assert\NotBlank(message: "The color field cannot be empty.")]
    #[Assert\CssColor(message: "The color '{{ value }}' is not a valid CSS color.")]
    public ?string $color = null;

    #[Assert\NotBlank(message: "The score field cannot be empty.")]
    public ?float $score = null;

    #[Assert\NotBlank(message: "The project field cannot be empty.")]
    public ?int $projectId = null;
}
