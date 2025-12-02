<?php

namespace App\EventSubscriber;

use App\Entity\Task;
use App\Entity\TaskColumn;
use App\Entity\TaskTag;
use App\Event\ProjectCreatedEvent;
use App\Repository\TaskTagRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\String\Slugger\SluggerInterface;

readonly class ProjectCreatedSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private TaskTagRepository      $labelRepository,
        private SluggerInterface       $slugger,
    )
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
        $defaultTask = new Task()
            ->setName('Welcome to your new project!')
            ->setDescription('This is your first task. You can edit or delete it as you like.')
            ->setDueAt((new DateTimeImmutable)->modify('+7 days'));

        foreach (['Backlog', 'In Progess', 'Review', 'Done'] as $index => $columnName) {
            $column = new TaskColumn()
                ->setName($columnName)
                ->setProject($project)
                ->setScore($index * 1000);

            if ($columnName === 'Backlog') {
                $labelName = 'First Steps';
                $label = $this->labelRepository
                    ->findOneBySlug($labelName);

                if ($label === null) {
                    $label = new TaskTag()
                        ->setName($labelName)
                        ->setSlug(
                            $this->slugger
                                ->slug($labelName)
                                ->lower()
                                ->toString()
                        );
                    $this->entityManager->persist($label);
                }

                $defaultTask
                    ->setRelatedColumn($column)
                    ->addTag($label)
                    ->setScore(0);

                $this->entityManager->persist($defaultTask);
            }
            $this->entityManager->persist($column);
        }

        $this->entityManager->flush();

    }
}
