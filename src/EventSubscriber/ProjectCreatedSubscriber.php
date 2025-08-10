<?php

namespace App\EventSubscriber;

use App\Entity\Label;
use App\Entity\TaskColumn;
use App\Event\ProjectCreatedEvent;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

final readonly class ProjectCreatedSubscriber implements EventSubscriberInterface
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            ProjectCreatedEvent::class => 'createDefaultColumns',
        ];
    }

    public function createDefaultColumns(ProjectCreatedEvent $event): void
    {
        $project = $event->project;
        $task = $event->defaultTask;
        $colors = [
            "#007bff",
            "#28a745",
            "#ffc107",
            "#dc3545",
        ];
        foreach (["To Do", "In Progress", "Review", "Done"] as $index => $c) {
            $column = new TaskColumn()
                ->setName($c)
                ->setScore($index * 1000)
                ->setColor($colors[$index])
                ->setProject($project);

            if ($c === "To Do") {
                $label = $this->entityManager->getRepository(Label::class)
                    ->findOneBy(["name" => "First Steps"]);

                if (null === $label) {
                    $label = new Label()
                        ->setName("First Steps");
                    $this->entityManager->persist($label);
                }

                $task?->setProject($project)
                    ->setRelatedColumn($column);

                $this->entityManager->persist($task);
            }

            $this->entityManager->persist($column);
        }

        $this->entityManager->flush();
    }
}
