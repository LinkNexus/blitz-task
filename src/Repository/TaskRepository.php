<?php

namespace App\Repository;

use App\Entity\Task;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Task>
 */
class TaskRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Task::class);
    }

    /**
     * Find tasks in a column
     * @param int $columnId The column id
     * @param int $offset The offset to start from
     * @param int $limit The number of tasks to return
     * @return Task[] The tasks in the column
     */
    public function findTasksByColumn(int $columnId, int $offset, int $limit = 5): array
    {
        return $this->createQueryBuilder('t')
            ->andWhere('t.relatedColumn = :columnId')
            ->setParameter('columnId', $columnId)
            ->orderBy('t.position', 'ASC')
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find the number of tasks in a column
     * @param int $columnId The column id
     * @return int The number of tasks in the column
     */
    public function findTaskCountByColumn(int $columnId): int
    {
        return $this->createQueryBuilder('t')
            ->select('COUNT(t.id)')
            ->andWhere('t.relatedColumn = :columnId')
            ->setParameter('columnId', $columnId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function findHighestTaskScore(int $columnId): int
    {
        $result = $this->createQueryBuilder('t')
            ->select('MAX(t.score)')
            ->andWhere('t.relatedColumn = :columnId')
            ->setParameter('columnId', $columnId)
            ->getQuery()
            ->getSingleScalarResult();

        return $result !== null ? (int) $result : 0;
    }

    //    /**
    //     * @return Task[] Returns an array of Task objects
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

    //    public function findOneBySomeField($value): ?Task
    //    {
    //        return $this->createQueryBuilder('t')
    //            ->andWhere('t.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
