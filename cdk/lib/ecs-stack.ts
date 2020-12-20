import { Stack, Construct, StackProps, Duration, CfnOutput } from "@aws-cdk/core";
import { Vpc, SubnetType, } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import { Cluster, ContainerImage } from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "@aws-cdk/aws-ecs-patterns";

interface EcsStackProps extends StackProps {
    readonly prefix: string;
    readonly stage: string;
    readonly ecrRepoName: string;
}


export class EcsStack extends Stack {

    constructor(scope: Construct, id: string, props: EcsStackProps) {
        super(scope, id, props);

        const { prefix, stage, ecrRepoName } = props;

        /**
         * Subnet Config
         */
        const subnetConfiguration = [
            {
                cidrMask: 26,
                name: `Public-`,
                subnetType: SubnetType.PUBLIC
            },
            {
                cidrMask: 26,
                name: `Private-`,
                subnetType: SubnetType.PRIVATE
            },

        ];

        /**
         * Vpc Definition
         */
        const vpc = new Vpc(this, `Vpc`, {
            cidr: "192.168.0.0/22",
            subnetConfiguration,
            maxAzs: 2
        });

        const repository = Repository.fromRepositoryName(this, "Repository", ecrRepoName);
        const imageTag = process.env.CODEBUILD_RESOLVED_SOURCE_VERSION || "local";

        /**
         * Cluster Definition
         */
        const cluster = new Cluster(this, `${prefix}-${stage}-Cluster`, {
            clusterName: `${prefix}-${stage}-Cluster`,
            vpc: vpc,
        });

        /**
         * Application Load Balancer - Fargate Service
         */
        const albService = new ApplicationLoadBalancedFargateService(this, `${prefix}-${stage}-ALB-Fargate-Service`, {
            cluster: cluster,
            cpu: 256,
            memoryLimitMiB: 512,
            taskImageOptions: {
                containerName: `${prefix}-${stage}-Container`,
                containerPort: 8080,
                image: ContainerImage.fromEcrRepository(repository, imageTag),
            },

            publicLoadBalancer: true,
            healthCheckGracePeriod: Duration.seconds(10),
        });

        /**
         * Auto Scalling Setting
         */
        const serviceScaling = albService.service.autoScaleTaskCount({ maxCapacity: 10 });
        serviceScaling.scaleOnCpuUtilization("ScalingCpu", {
            targetUtilizationPercent: 60,
        });

        /**
         * Target Group 
         */
        albService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "30");

        /**
         * Helth Check
         */
        albService.targetGroup.configureHealthCheck({
            enabled: true,
            path: "/_health",
        });

        new CfnOutput(this, `${prefix}-${stage}-ALB-Http-End-Point`, {
            value: albService.loadBalancer.loadBalancerDnsName
        });
    }
}
