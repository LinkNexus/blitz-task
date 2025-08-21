<?php

namespace App\Repository;

use App\Entity\Attachment;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Attachment>
 */
class AttachmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Attachment::class);
    }

    /**
     * Find attachment by a specific parameter
     * @param string $key The parameter name
     * @param int|string $value The parameter value
     * @return Attachment|null
     */
    public function findWithTeamByParam(string $key, int|string $value): ?Attachment
    {
        return $this->createQueryBuilder("a")
            ->select("a")
            ->leftJoin("a.task", "task")
            ->addSelect('task')
            ->leftJoin("task.project", "project")
            ->addSelect('project')
            ->leftJoin("project.team", "team")
            ->addSelect('team')
            ->where("a.$key = :value")
            ->setParameter("value", $value)
            ->getQuery()
            ->getOneOrNullResult();
    }

    //    /**
    //     * @return Attachment[] Returns an array of Attachment objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('a')
    //            ->andWhere('a.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('a.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?Attachment
    //    {
    //        return $this->createQueryBuilder('a')
    //            ->andWhere('a.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
