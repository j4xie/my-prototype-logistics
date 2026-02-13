"""Run command on old server via Alibaba Cloud RunCommand API"""
import sys, json, base64, time, os
from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.request import CommonRequest

AK_OLD = (os.environ.get('ALIYUN_OLD_AK_ID', ''), os.environ.get('ALIYUN_OLD_AK_SECRET', ''))
INSTANCE_OLD = os.environ.get('ALIYUN_OLD_INSTANCE', 'i-uf60ay6ti5cm40j7jvh9')

def run(script, timeout=120):
    client = AcsClient(AK_OLD[0], AK_OLD[1], 'cn-shanghai')
    req = CommonRequest()
    req.set_accept_format('json')
    req.set_domain('ecs.aliyuncs.com')
    req.set_method('POST')
    req.set_version('2014-05-26')
    req.set_action_name('RunCommand')
    req.add_query_param('RegionId', 'cn-shanghai')
    req.add_query_param('Type', 'RunShellScript')
    req.add_query_param('CommandContent', script)
    req.add_query_param('InstanceId.1', INSTANCE_OLD)
    req.add_query_param('Timeout', timeout)
    resp = json.loads(client.do_action_with_exception(req))
    invoke_id = resp['InvokeId']

    for i in range(timeout // 3 + 10):
        time.sleep(3)
        req2 = CommonRequest()
        req2.set_accept_format('json')
        req2.set_domain('ecs.aliyuncs.com')
        req2.set_method('POST')
        req2.set_version('2014-05-26')
        req2.set_action_name('DescribeInvocationResults')
        req2.add_query_param('RegionId', 'cn-shanghai')
        req2.add_query_param('InvokeId', invoke_id)
        resp2 = json.loads(client.do_action_with_exception(req2))
        results = resp2['Invocation']['InvocationResults']['InvocationResult']
        if results:
            s = results[0]['InvocationStatus']
            if s in ('Finished', 'Success', 'Failed', 'Timeout'):
                output = base64.b64decode(results[0].get('Output', '')).decode('utf-8', errors='replace')
                print(f'[{s}]')
                print(output)
                return
    print('Timed out waiting')

if __name__ == '__main__':
    script = sys.argv[1] if len(sys.argv) > 1 else 'echo hello'
    timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    run(script, timeout)
