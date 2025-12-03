<?php

namespace App\DataFixtures;

use App\Entity\TaskTag;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Faker\Factory;
use Symfony\Component\String\Slugger\SluggerInterface;

class TaskTagFixture extends Fixture
{
    public function __construct(
        private readonly SluggerInterface $slugger
    )
    {
    }

    public function load(ObjectManager $manager): void
    {
        $faker = Factory::create();

        for ($i = 0; $i < 25; $i++) {
            $tag = new TaskTag()
                ->setName($faker->word())
                ->setSlug($this->slugger->slug($faker->word())->toString());
            $manager->persist($tag);
        }

        $manager->flush();
    }
}
