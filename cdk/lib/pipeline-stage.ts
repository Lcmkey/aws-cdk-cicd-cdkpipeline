import { Stage, Construct, StackProps } from "@aws-cdk/core";
import { EcsStack } from "./ecs-stack";

interface PipelineStageProps extends StackProps {
    readonly prefix: string;
    readonly stage: string;
    readonly ecrRepoName: string;
}

export class PipelineStage extends Stage {
    constructor(scope: Construct, id: string, props: PipelineStageProps) {
        super(scope, id, props);

        const { prefix, stage, ecrRepoName } = props;

        new EcsStack(this, "Ecs-Stack", { prefix, stage, ecrRepoName });
    }
}
