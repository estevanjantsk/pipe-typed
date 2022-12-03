import fs from 'fs'
import path from 'path'
import openapi from './openapi.json'

const groupMethodsByTag = () => {
	const grouped = Object.entries(openapi.paths)
		.reduce((group, entry) => {
			const [path, pathContent] = entry
			const pathContentEntries = Object.entries(pathContent)

			pathContentEntries.forEach(([method, content]) => {
				const tag = content.tags[0]
				group[tag] = group[tag] ?? [];
				group[tag].push({
					path,
					method,
					content
				});
			})
			return group
		}, {})
	return grouped;
}

/**
	* Tag: [
	*		{ path: '/webhooks', method: 'get', content: [Object] },
	*		{ path: '/webhooks', method: 'post', content: [Object] },
	*		{ path: '/webhooks/{id}', method: 'delete', content: [Object] }
	*	]
 */
const groupedMethodsByTag = groupMethodsByTag()

const generateParams = (path, method, content) => {
	let params: Array<string> = [];

  if(content.parameters) {
		// handle path!!!
		content.parameters.forEach((param: any) => {
			if(param.in === "path") {
				params.push(`${param.name.replace('-', '')}: paths['${path}']['${method}']['parameters']['path']['${param.name}']`)
			}
		})
		// handle query!!!
		const hasQuery = content.parameters.find(param => param.in === "query");
		if(hasQuery && content.parameters.length > 1) {
			params.push(`query: paths['${path}']['${method}']['parameters']['query']`)
		}
		if(hasQuery && content.parameters.length === 1) {
			const name = content.parameters[0].name;
			params.push(`${name}: paths['${path}']['${method}']['parameters']['query']['${name}']`)
		}
	}

	// hand requestBody
	if(content.requestBody) {
		const contentType = Object.keys(content.requestBody.content)[0];
		params.push(`body: paths['${path}']['${method}']['requestBody']['content']['${contentType}']`)
	}

	return params.join(', ');
}

const generateResponses = (path, method, content) => {
	const success: Array<string> = [];
	// const error: Array<string> = [];

	Object.entries(content.responses).forEach(([code, _responseContent]) => {
		// success
		if(code.startsWith('2')) {
			success.push(`paths['${path}']['${method}']['responses']['${code}']['content']['application/json']`)
		} 
		// else { // error
			// error.push(`paths['${path}']['${method}']['responses']['${code}']['content']['application/json']`)
		// }
	})

	// if(success.length >= 1 && error.length >= 1) {
	// 	return `${success.join(' | ')}, ${error.join(' | ')}`;
	// }

	if(success.length >= 1) {
		return `${success.join(' | ')}`;
	}

	return 'void';
} 

const generateInterfaces = () => {
	const filePath = path.join(__dirname, 'pipedrive.ts')
	const file = fs.readFileSync(filePath, 'utf8');
	return file
		.replace(/export /g, '')
		.replace(/parameters\?/g, 'parameters')
		.replace(/query\?/g, 'query')
		.replace(/requestBody\?/g, 'requestBody');
}

const generateMethods = (tag: string) => {
	let methods = ''
	const data = groupedMethodsByTag[tag]

	data.forEach(({path, method, content}) => {
		const { operationId } = content

		methods += `
		${operationId}(
			${generateParams(path, method, content)}
		): Promise<${generateResponses(path, method, content)}>;
		`
	})

	return methods
}

const generateClass = (tag: string) => {
	return `
	export class ${tag}Api {
		constructor(client: ApiClientInstance);
		${generateMethods(tag)}
	}
`
}

const generateClasses = () => {
	let content = '';
	openapi.tags.forEach(tag => {
		content += generateClass(tag.name);
	});
	return content;
}

const init = () => {
	const base = `
/* eslint-disable max-classes-per-file */
	
declare module 'pipedrive' {

	export class ApiClient {
		authentications: any;
	}

	type ApiClientInstance = ApiClient;
	${generateClasses()}
}
	
	${generateInterfaces()}
`
	
	fs.writeFileSync('./generated/pipedrive.d.ts', base, { encoding: 'utf8' })
}

init()