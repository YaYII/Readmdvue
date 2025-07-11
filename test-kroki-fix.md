# Kroki Base64 编码修复测试

## 测试说明
这个文档用于测试修复后的 Kroki Base64 编码问题。

## 1. 简单的 Graphviz 图表

```graphviz
digraph G {
    rankdir=LR;
    A -> B;
    B -> C;
    C -> D;
    D -> A;
}
```

## 2. 包含特殊字符的 Graphviz 图表

```graphviz
digraph G {
    rankdir=LR;
    A [label="开始节点"];
    B [label="处理节点"];
    C [label="结束节点"];
    A -> B [label="执行"];
    B -> C [label="完成"];
}
```

## 3. Mermaid 流程图

```mermaid
graph TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作A]
    B -->|否| D[执行操作B]
    C --> E[结束]
    D --> E
```

## 4. PlantUML 序列图

```plantuml
@startuml
Alice -> Bob: 认证请求
Bob --> Alice: 认证响应

Alice -> Bob: 另一个认证请求
Alice <-- Bob: 另一个认证响应
@enduml
```

## 5. 复杂的 Graphviz 图表

```graphviz
digraph complex {
    rankdir=TB;
    node [shape=box, style=filled, color=lightblue];
    
    subgraph cluster_0 {
        label="子系统A";
        style=filled;
        color=lightgrey;
        a0 -> a1 -> a2 -> a3;
    }
    
    subgraph cluster_1 {
        label="子系统B";
        style=filled;
        color=lightgrey;
        b0 -> b1 -> b2 -> b3;
    }
    
    start -> a0;
    start -> b0;
    a1 -> b3;
    b2 -> a3;
    a3 -> end;
    b3 -> end;
    
    start [shape=Mdiamond];
    end [shape=Msquare];
}
```

## 测试要点

1. **Base64 编码**: 确保所有图表内容都能正确编码
2. **特殊字符处理**: 中文字符和特殊符号的正确处理
3. **语法验证**: 基本的图表语法检查
4. **错误处理**: 无效内容的错误提示
5. **网络请求**: Kroki API 的正确调用

## 预期结果

- 所有图表都应该能够正常渲染
- 不应该出现 400 Bad Request 错误
- 控制台应该显示正确的 URL 生成日志
- 错误的图表语法应该有适当的警告或错误提示