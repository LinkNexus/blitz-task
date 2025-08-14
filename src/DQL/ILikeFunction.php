<?php

# src/DQL/ILikeFunction.php
namespace App\DQL;

use Doctrine\ORM\Query\AST\Functions\FunctionNode;
use Doctrine\ORM\Query\AST\Node;
use Doctrine\ORM\Query\Parser;
use Doctrine\ORM\Query\SqlWalker;
use Doctrine\ORM\Query\TokenType;

class ILikeFunction extends FunctionNode
{
    public ?Node $field = null;
    public ?Node $value = null;

    public function parse(Parser $parser): void
    {
        $parser->match(TokenType::T_IDENTIFIER);
        $parser->match(TokenType::T_OPEN_PARENTHESIS);

        $this->field = $parser->ArithmeticPrimary();
        $parser->match(TokenType::T_COMMA);

        $this->value = $parser->ArithmeticPrimary();
        $parser->match(TokenType::T_CLOSE_PARENTHESIS);
    }

    public function getSql(SqlWalker $sqlWalker): string
    {
        return sprintf(
            '%s ILIKE %s',
            $this->field->dispatch($sqlWalker),
            $this->value->dispatch($sqlWalker)
        );
    }
}
