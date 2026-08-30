import{a as e,c as t,d as n,l as r,n as i,o as a,s as o,t as s,u as c}from"./CrudTable-DAcasEna.js";import{n as l}from"./rolldown-runtime-DkW27tQK.js";var u,d,f,p,m,h,g,_,v,y,b,x,S;function C(){return(C=l((()=>{i(),t(),a(),c(),u=n(),d=Array.from({length:23},(e,t)=>({id:t+1,name:`Person ${t+1}`,email:`person${t+1}@example.com`,status:t%3==0?`inactive`:`active`})),f=[{dataIndex:`name`,title:`Name`,fieldType:`string`,formConfig:{required:!0}},{dataIndex:`email`,title:`Email`,fieldType:`email`},{dataIndex:`status`,title:`Status`,fieldType:`enum`,enumOptions:{active:{text:`Active`,color:`green`},inactive:{text:`Inactive`,color:`red`}}}],p=()=>{let e=new r(d,`id`);return(async(t,n)=>{let r=new URL(String(t),`http://storybook.local`);if(await new Promise(e=>setTimeout(e,400)),!n?.method||n.method===`GET`){let t=await e.list({page:Number(r.searchParams.get(`current`)??1),pageSize:Number(r.searchParams.get(`pageSize`)??10)});return new Response(JSON.stringify({data:t.items,total:t.total}),{status:200})}return new Response(JSON.stringify(d[0]),{status:200})})},m={title:`Data strategies`,component:s,parameters:{docs:{description:{component:`The same table over each data strategy. Every one implements CrudDataSource, so the columns and behaviour are identical and only the wiring differs.`}}}},h={name:`Static fixture`,render:()=>(0,u.jsx)(s,{title:`Users (static)`,rowKey:`id`,columns:f,defaultPageSize:5,enableBulkOperations:!0,hookConfig:{staticData:d}})},g={name:`localStorage (persists across reloads)`,render:()=>(0,u.jsx)(s,{title:`Users (localStorage)`,rowKey:`id`,columns:f,defaultPageSize:5,hookConfig:{storageKey:`storybook-users`,initialData:d.slice(0,8)}})},_={name:`REST (simulated latency)`,render:()=>(0,u.jsx)(s,{title:`Users (REST)`,rowKey:`id`,columns:f,defaultPageSize:5,hookConfig:{api:{baseUrl:`/api`,endpoints:{list:`/users`,create:`/users`,update:`/users`,remove:`/users`},fetchImpl:p()}}})},v={name:`Custom operations (read-only)`,render:()=>(0,u.jsx)(s,{title:`Users (read-only source)`,rowKey:`id`,columns:f,defaultPageSize:5,hookConfig:{operations:{list:async e=>({items:d.slice((e.page-1)*e.pageSize,e.page*e.pageSize),total:d.length})}}})},y={name:`Consumer-owned data source`,render:()=>{let e=new o(`storybook-owned`,`id`,d.slice(0,5));return(0,u.jsx)(s,{title:`Users (injected source)`,rowKey:`id`,columns:f,defaultPageSize:5,hookConfig:{dataSource:e}})}},b={name:`UUID row keys`,render:()=>{let e=new r([{uuid:`a3f9-1111`,title:`Existing document`}],`uuid`);return(0,u.jsx)(s,{title:`Documents (string keys)`,rowKey:`uuid`,columns:[{dataIndex:`title`,title:`Title`,fieldType:`string`}],hookConfig:{dataSource:e}})}},x={name:`REST with a different dialect`,render:()=>{let t=new e({baseUrl:`/api`,endpoints:{list:`/users`,create:`/users`,update:`/users`,remove:`/users`},paramNames:{page:`page`,pageSize:`limit`,sortBy:`order_by`,sortOrder:`direction`},methods:{update:`PATCH`},fetchImpl:p()});return(0,u.jsx)(s,{title:`Users (page/limit, PATCH)`,rowKey:`id`,columns:f,defaultPageSize:5,hookConfig:{dataSource:t}})}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: 'Static fixture',
  render: () => <CrudTable<User, 'id'> title="Users (static)" rowKey="id" columns={columns} defaultPageSize={5} enableBulkOperations hookConfig={{
    staticData: users
  }} />
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'localStorage (persists across reloads)',
  render: () => <CrudTable<User, 'id'> title="Users (localStorage)" rowKey="id" columns={columns} defaultPageSize={5} hookConfig={{
    storageKey: 'storybook-users',
    initialData: users.slice(0, 8)
  }} />
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: 'REST (simulated latency)',
  render: () => <CrudTable<User, 'id'> title="Users (REST)" rowKey="id" columns={columns} defaultPageSize={5} hookConfig={{
    api: {
      baseUrl: '/api',
      endpoints: {
        list: '/users',
        create: '/users',
        update: '/users',
        remove: '/users'
      },
      fetchImpl: fakeApi()
    }
  }} />
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'Custom operations (read-only)',
  render: () => <CrudTable<User, 'id'> title="Users (read-only source)" rowKey="id" columns={columns} defaultPageSize={5} hookConfig={{
    // Only \`list\` is supplied; the write paths report which operation is
    // missing rather than failing on undefined.
    operations: {
      list: async query => ({
        items: users.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: users.length
      })
    }
  }} />
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Consumer-owned data source',
  render: () => {
    const source: CrudDataSource<User, 'id'> = new LocalStorageDataSource<User, 'id'>('storybook-owned', 'id', users.slice(0, 5));
    return <CrudTable<User, 'id'> title="Users (injected source)" rowKey="id" columns={columns} defaultPageSize={5} hookConfig={{
      dataSource: source
    }} />;
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'UUID row keys',
  render: () => {
    interface Doc {
      uuid: string;
      title: string;
    }
    const source = new StaticDataSource<Doc, 'uuid'>([{
      uuid: 'a3f9-1111',
      title: 'Existing document'
    }], 'uuid');
    return <CrudTable<Doc, 'uuid'> title="Documents (string keys)" rowKey="uuid" columns={[{
      dataIndex: 'title',
      title: 'Title',
      fieldType: 'string'
    }]} hookConfig={{
      dataSource: source
    }} />;
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: 'REST with a different dialect',
  render: () => {
    const source = new RestDataSource<User, 'id'>({
      baseUrl: '/api',
      endpoints: {
        list: '/users',
        create: '/users',
        update: '/users',
        remove: '/users'
      },
      paramNames: {
        page: 'page',
        pageSize: 'limit',
        sortBy: 'order_by',
        sortOrder: 'direction'
      },
      methods: {
        update: 'PATCH'
      },
      fetchImpl: fakeApi()
    });
    return <CrudTable<User, 'id'> title="Users (page/limit, PATCH)" rowKey="id" columns={columns} defaultPageSize={5} hookConfig={{
      dataSource: source
    }} />;
  }
}`,...x.parameters?.docs?.source}}},S=[`StaticData`,`LocalStorage`,`Rest`,`CustomOperations`,`ConsumerOwnedSource`,`UuidKeys`,`RestWithRenamedParams`]})))()}C();export{y as ConsumerOwnedSource,v as CustomOperations,g as LocalStorage,_ as Rest,x as RestWithRenamedParams,h as StaticData,b as UuidKeys,S as __namedExportsOrder,m as default};