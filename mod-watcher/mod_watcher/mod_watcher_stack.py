from aws_cdk import (
    core,
    aws_lambda as _lambda,
    aws_ec2 as _ec2,
    aws_apigateway as _apigw,
    aws_ssm as _ssm,
    aws_secretsmanager as _sm,
    aws_dynamodb as _ddb,
    aws_s3 as _s3,
    aws_iam as _iam,
    aws_events as _events,
    aws_events_targets as _targets,
)


class ModWatcherStack(core.Stack):

    def __init__(self, scope: core.Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # API Gateway
        base_api = _apigw.RestApi(self, 'ModWatcherAPIGateway',
                                  rest_api_name='ModWatcherAPIGateway', deploy_options=_apigw.StageOptions(variables={"stage": "Prod"}))

        # Discourse API Lambda
        watcher_lambda = _lambda.Function(self, 'ModWatcherAPILambda',
                                          handler='ModWatcherAPI_lambda.handler',
                                          runtime=_lambda.Runtime.NODEJS_12_X,
                                          timeout=core.Duration.seconds(
                                                60*10),
                                          memory_size=512,
                                          code=_lambda.Code.asset(
                                              'ModWatcherAPI_lambda'),
                                          )

        self.createNoAuthEndpoint(base_api, 'ModWatcherAPI', watcher_lambda)

        watcher_lambda.add_to_role_policy(_iam.PolicyStatement(resources=["*"],
                                                               actions=["lambda:GetAccountSettings"], effect=_iam.Effect.ALLOW))

        watcher_lambda.add_to_role_policy(_iam.PolicyStatement(resources=["*"],
                                                               actions=["ses:SendEmail"], effect=_iam.Effect.ALLOW))

        mailgun_param = _ssm.StringParameter.from_string_parameter_name(
            self, "MailgunAPIKeyParam", string_parameter_name="MailgunAPIKey")

        mailgun_param.grant_read(watcher_lambda)

        watcher_lambda.add_environment(
            "MAILGUN_API_PARAM", mailgun_param.parameter_name)

        apikey_param = _ssm.StringParameter.from_string_parameter_name(
            self, "BungieAPICredentialsParam", string_parameter_name="BungieAPICredentials")

        apikey_param.grant_read(watcher_lambda)

        watcher_lambda.add_environment(
            "BUNGIE_API_PARAM", apikey_param.parameter_name)

        # ddb table to store oauth secrets
        ddb_table = _ddb.Table(self, 'ModWatchersTable', partition_key=_ddb.Attribute(
            name="email", type=_ddb.AttributeType.STRING))

        ddb_table.grant_full_access(watcher_lambda.role)

        watcher_lambda.add_environment(
            "DDB_TABLE", ddb_table.table_name)

        # run our script every so often
        run_rule = _events.Rule(self, "ModWatcherTask", description="Check vendor info",
                                enabled=True,
                                rule_name="ModWatcherTask", schedule=_events.Schedule.expression("cron(10 * * * ? *)"))

        run_rule.add_target(_targets.LambdaFunction(
            watcher_lambda, event=_events.RuleTargetInput.from_object({"send_updates": "all"})))

    def createNoAuthEndpoint(self, base_api, endpoint, handler):

        # add /update endpoint
        update_ep = base_api.root.add_resource(endpoint)
        update_ep_lambda_integration = _apigw.LambdaIntegration(handler, proxy=True, integration_responses=[
            {
                'statusCode': '200',
                'responseParameters': {
                    'method.response.header.Access-Control-Allow-Origin': "'*'",
                }
            }]
        )

        update_ep.add_method('POST', update_ep_lambda_integration,
                             authorization_type=_apigw.AuthorizationType.NONE,
                             method_responses=[{
                                 'statusCode': '200',
                                 'responseParameters': {
                                     'method.response.header.Access-Control-Allow-Origin': True,
                                 }
                             }]
                             )

        update_ep.add_method('GET', update_ep_lambda_integration,
                             authorization_type=_apigw.AuthorizationType.NONE,
                             method_responses=[{
                                 'statusCode': '200',
                                 'responseParameters': {
                                     'method.response.header.Access-Control-Allow-Origin': True,
                                 }
                             }]
                             )

        self.add_cors_options(update_ep)

    def add_cors_options(self, apigw_resource):
        apigw_resource.add_method('OPTIONS', _apigw.MockIntegration(
            integration_responses=[{
                'statusCode': '200',
                'responseParameters': {
                    'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                    'method.response.header.Access-Control-Allow-Origin': "'*'",
                    'method.response.header.Access-Control-Allow-Methods': "'POST,GET,OPTIONS'"
                }
            }
            ],
            passthrough_behavior=_apigw.PassthroughBehavior.WHEN_NO_MATCH,
            request_templates={"application/json": "{\"statusCode\":200}"}
        ),
            method_responses=[{
                'statusCode': '200',
                'responseParameters': {
                    'method.response.header.Access-Control-Allow-Headers': True,
                    'method.response.header.Access-Control-Allow-Methods': True,
                    'method.response.header.Access-Control-Allow-Origin': True,
                }
            }
        ],
        )
