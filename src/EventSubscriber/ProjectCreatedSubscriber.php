<?php

namespace App\EventSubscriber;

use App\Entity\Task;
use App\Entity\TaskColumn;
use App\Entity\TaskLabel;
use App\Event\ProjectCreatedEvent;
use App\Repository\TaskLabelRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\String\Slugger\SluggerInterface;

class ProjectCreatedSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly TaskLabelRepository $labelRepository,
        private readonly SluggerInterface $slugger,
    ) {}

    public function createDefaultColumns(ProjectCreatedEvent $event): void
    {
        $project = $event->project;
        $defaultTask = new Task()
            ->setName('Welcome to your new project!')
            ->setDescription('This is your first task. You can edit or delete it as you like.')
            ->setDueAt((new \DateTimeImmutable)->modify('+7 days'));

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
                    $label = new TaskLabel()
                        ->setName($labelName)
                        ->setSlug(
                            $this->slugger
                                ->slug($labelName)
                                ->lower()
                                ->toString()
                        );
                    $this->entityManager->persist($label);
                }

                $defaultTask->setProject($project)
                    ->setRelatedColumn($column)
                    ->addLabel($label);

                $this->entityManager->persist($defaultTask);
            }
            $this->entityManager->persist($column);
        }

        $this->entityManager->flush();

    }

    public static function getSubscribedEvents(): array
    {
        return [
            ProjectCreatedEvent::class => 'createDefaultColumns',
        ];
    }
}
