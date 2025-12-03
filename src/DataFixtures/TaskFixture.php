<?php

namespace App\DataFixtures;

use App\Entity\Project;
use App\Entity\Task;
use App\Entity\TaskTag;
use App\Enum\TaskPriority;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use Faker\Factory;

class TaskFixture extends Fixture implements DependentFixtureInterface
{
    public function load(ObjectManager $manager): void
    {
        $mainProject = $this->getReference(ProjectFixture::MAIN_PROJECT_REFERENCE, Project::class);
        $faker = Factory::create();
        $columnsIds = $mainProject->getColumns()->map(fn($column) => $column->getId())->toArray();

        $labels = $manager
            ->getRepository(TaskTag::class)
            ->findAll();
        $labelsIds = array_map(fn(TaskTag $label) => $label->getId(), $labels);

        for ($i = 0; $i < 20; $i++) {
            $task = new Task()
                ->setName($faker->sentence(3, 4))
                ->setDescription($faker->sentence(20))
                ->setScore($faker->numberBetween(100, 1000))
                ->setRelatedColumn(
                    $mainProject->getColumns()
                        ->get($faker->numberBetween(0, count($columnsIds) - 1))
                )
                ->setDueAt(
                    $faker->numberBetween(0, 1) === 0 ?
                        null :
                        DateTimeImmutable::createFromMutable($faker->dateTimeBetween('-1 month', '+1 month'))
                )
                ->setPriority(TaskPriority::random());

            for ($j = 0; $j < $faker->numberBetween(1, 5); $j++) {
                $task->addTag($labels[$faker->numberBetween(0, count($labelsIds) - 1)]);
            }


            for ($j = 0; $j < $faker->numberBetween(1, 5); $j++) {
                $task->addAssignee(
                    $mainProject->getParticipants()
                        ->get(
                            $faker->numberBetween(
                                0,
                                count($mainProject->getParticipants()) - 1
                            )
                        )
                );
            }

            $manager->persist($task);
        }

        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [
            ProjectFixture::class,
            TaskTagFixture::class
        ];
    }
}
