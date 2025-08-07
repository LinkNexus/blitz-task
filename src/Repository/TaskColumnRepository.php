<?php

namespace App\Repository;

use App\Entity\TaskColumn;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TaskColumn>
 */
class TaskColumnRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TaskColumn::class);
    }

    /**
     * Find columns by project
     * @param int $projectId The project id
     * @return TaskColumn[] The columns
     */
    public function findByProject(int $projectId): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.project = :projectId')
            ->setParameter('projectId', $projectId)
            ->orderBy('c.score', 'ASC')
            ->getQuery()
            ->getResult();
    }

    //    /**
    //     * @return TaskColumn[] Returns an array of TaskColumn objects
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

    //    public function findOneBySomeField($value): ?TaskColumn
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
