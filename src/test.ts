import pipedrive from "pipedrive";

const apiClient = new pipedrive.ApiClient();

const api = new pipedrive.CallLogsApi(apiClient);

api.getCallLog('13')
	.then((res) => {
		console.log(res.data?.activity_id)
	})