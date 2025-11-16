<?php

namespace App\Repository;

use App\Entity\TaskLabel;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\String\Slugger\SluggerInterface;

/**
 * @extends ServiceEntityRepository<TaskLabel>
 */
class TaskLabelRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry, private readonly SluggerInterface $slugger)
    {
        parent::__construct($registry, TaskLabel::class);
    }

    /**
     * Search for a label by its slug.
     *
     * @param  string  $slug  The name to slugify and search for
     * @return ?TaskLabel The found TaskLabel or null if not found
     */
    public function findOneBySlug($slug)
    {
        return $this->findOneBy(['slug' => $this->slugger->slug($slug)->lower()->toString()]);
    }

    //    /**
    //     * @return TaskLabel[] Returns an array of TaskLabel objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('t.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?TaskLabel
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
