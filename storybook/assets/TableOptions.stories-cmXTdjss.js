import{d as e,f as t,n,p as r,t as i}from"./CrudTable-BiqY21-J.js";import{n as a}from"./rolldown-runtime-DkW27tQK.js";var o,s,c,l,u,d,f,p,m,h,g,_,v,y;function b(){return(b=a((()=>{r(),n(),o=e(),s=Array.from({length:12},(e,t)=>({id:t+1,title:`Task ${t+1}`,done:t%2==0,priority:[`low`,`medium`,`high`][t%3]})),c=[{dataIndex:`title`,title:`Title`,fieldType:`string`,formConfig:{required:!0}},{dataIndex:`done`,title:`Done`,fieldType:`boolean`},{dataIndex:`priority`,title:`Priority`,fieldType:`enum`,enumOptions:{low:{text:`Low`,color:`blue`},medium:{text:`Medium`,color:`orange`},high:{text:`High`,color:`red`}}}],l={title:`Table options`,component:i,parameters:{docs:{description:{component:`Toolbar flags, custom row actions, export scope and error handling.`}}}},u=e=>(0,o.jsx)(i,{title:`Tasks`,rowKey:`id`,columns:c,defaultPageSize:5,hookConfig:{staticData:s},...e}),d={name:`Defaults`,render:()=>u({})},f={name:`Bulk operations`,render:()=>u({enableBulkOperations:!0})},p={name:`Column settings disabled`,render:()=>u({enableColumnSettings:!1})},m={name:`Export disabled`,render:()=>u({enableExport:!1})},h={name:`Export scoped to the visible page`,render:()=>u({exportScope:`page`})},g={name:`Custom row actions`,render:()=>u({customActions:(e,n)=>[(0,o.jsx)(t,{type:`link`,size:`small`,onClick:()=>void n.update(e.id,{done:!e.done}),children:e.done?`Reopen`:`Complete`},`toggle`)]})},_={name:`Non-editable and non-searchable columns`,render:()=>u({columns:[{dataIndex:`title`,title:`Title`,fieldType:`string`},{dataIndex:`priority`,title:`Priority (read-only)`,fieldType:`string`,fieldEditable:!1},{dataIndex:`done`,title:`Done (not searchable)`,fieldType:`boolean`,searchable:!1}]})},v={name:`Failing data source`,render:()=>u({hookConfig:{dataSource:{list:async()=>{throw Error(`The backend is unavailable`)},create:async()=>s[0],update:async()=>s[0],remove:async()=>void 0},onError:(e,t)=>console.error(e,t.message)}})},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: 'Defaults',
  render: () => table({})
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: 'Bulk operations',
  render: () => table({
    enableBulkOperations: true
  })
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'Column settings disabled',
  render: () => table({
    enableColumnSettings: false
  })
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: 'Export disabled',
  render: () => table({
    enableExport: false
  })
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: 'Export scoped to the visible page',
  render: () => table({
    exportScope: 'page'
  })
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'Custom row actions',
  render: () => table({
    customActions: (record, actions) => [<Button key="toggle" type="link" size="small" onClick={() => void actions.update(record.id, {
      done: !record.done
    })}>
          {record.done ? 'Reopen' : 'Complete'}
        </Button>]
  })
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: 'Non-editable and non-searchable columns',
  render: () => table({
    columns: [{
      dataIndex: 'title',
      title: 'Title',
      fieldType: 'string'
    },
    // Visible in the table, fixed in the form.
    {
      dataIndex: 'priority',
      title: 'Priority (read-only)',
      fieldType: 'string',
      fieldEditable: false
    }, {
      dataIndex: 'done',
      title: 'Done (not searchable)',
      fieldType: 'boolean',
      searchable: false
    }]
  })
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'Failing data source',
  render: () => {
    const failing: CrudDataSource<Task, 'id'> = {
      list: async () => {
        throw new Error('The backend is unavailable');
      },
      create: async () => tasks[0],
      update: async () => tasks[0],
      remove: async () => undefined
    };
    return table({
      hookConfig: {
        dataSource: failing,
        onError: (operation, error) => console.error(operation, error.message)
      }
    });
  }
}`,...v.parameters?.docs?.source}}},y=[`Defaults`,`BulkOperations`,`WithoutColumnSettings`,`WithoutExport`,`PageScopedExport`,`CustomActions`,`ReadOnlyColumns`,`FailingSource`]})))()}b();export{f as BulkOperations,g as CustomActions,d as Defaults,v as FailingSource,h as PageScopedExport,_ as ReadOnlyColumns,p as WithoutColumnSettings,m as WithoutExport,y as __namedExportsOrder,l as default};