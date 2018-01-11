#!/usr/bin/env node

'use strict';

var eutil=require("eutil");
var jsonFormat = require('json-format');
var fs = require('fs-extra');
var request=require('request');
var program = require("commander");
var pkg = require("./package.json");
var path=require("path");
function definitions_ref_obj(obj,definitions){
    this.obj=Object.assign({}, obj);
    this.definitions=definitions;
    this.next(Object.assign({}, obj));
    this.index=0;
    this.itemArray=[];
}
function  havaref(obj) {
    for (let item in obj){
       if(obj[item]['$ref'] || (obj[item].items && obj[item].items['$ref']))return true;
    }
    return false;
}
function forRef(_obj,definitions) {
    let obj=_obj;
    for (let item in obj) {
        if (obj[item]&&obj[item].type === "array" && obj[item].items) {
            if (obj[item].items['$ref']) {
                var schema_obj_name = obj[item].items['$ref'].substr("#/definitions/".length);
                let _obj_item=definitions[schema_obj_name].properties;
                if(havaref(_obj_item)) {
                    obj[item]=[forRef(_obj_item,definitions)];
                }
                else {

                    obj[item]=[_obj_item];
                    // obj[item]=([].push(_obj_item));
                }
            }else
            if(obj[item].items){
                 if(obj[item].items.default) obj[item]=[obj[item].items.default]
                 else obj[item]=[];
            }
            // obj[item]=[];
        }
        if (obj[item]&&obj[item]['$ref']) {
            let schema_obj_name = obj[item]['$ref'].substr("#/definitions/".length);
            let _obj_item=definitions[schema_obj_name].properties;
            if(havaref(_obj_item)) {
                obj[item] = forRef(_obj_item,definitions);
            }
            else obj[item] = _obj_item;
        }
    }
    return obj;
}

definitions_ref_obj.prototype.next = function(){
    let _schema_obj=forRef(this.obj,this.definitions);
   this.obj=serialize_definitions_schema_obj(_schema_obj);
};

function haveOwnproperty(data,propertyname){
    var result=false;
    for(var itemdata in data) {
        if(itemdata===propertyname) if(data[itemdata]!==null) result=true;
    }
    return result;
}


function serialize_definitions_schema_obj(obj){
    if(!(eutil.isJsonObject(obj) || eutil.isArray(obj))) return obj;
    if(obj.default) return obj.default;
    else
    for (let item in obj) {
          if ( obj[item]&&haveOwnproperty(obj[item],"default")) {
            if(eutil.isJsonObject(obj[item].default)){
                if(!eutil.isArray(obj[item])) obj[item]=serialize_definitions_schema_obj(obj[item].default);
                else obj[item]=[serialize_definitions_schema_obj(obj[item].default)];
                // console.log("3333->>>",obj[item].default,obj[item].type)
            }
            else {
                if(obj[item].type!=="number" && !obj[item].default)obj[item]=0;
                else obj[item]=obj[item].default;
            }
        }
        else if( obj[item]&&obj[item].type=="number"){
              obj[item]=0;

        }else if( obj[item]&&obj[item].type=="string"){
            obj[item]="string";

        }else
        for(let _item in obj[item]){
              if(obj[item]&&eutil.isArray(obj[item])){
                   obj[item]=[serialize_definitions_schema_obj(obj[item][_item])];
              }
            else if ( obj[item][_item]&&haveOwnproperty(obj[item][_item],"default")) {
                if(eutil.isJsonObject(obj[item][_item].default)){
                     obj[item][_item]=serialize_definitions_schema_obj(obj[item][_item].default);
                }
                else {
                    if(obj[item][_item].type!=="number" && !obj[item][_item].default)obj[item][_item]=0;
                    else obj[item][_item]=obj[item][_item].default;
                }
            }
            // if(obj[item][_item]&&eutil.isArray(obj[item][_item])){
            //     console.log(">>>>>>>>>",obj[item][_item])
            // }
        }
    }
    return obj;
}



function serialize_definitions(schema_obj_name,definitions) {
     return new definitions_ref_obj(definitions[schema_obj_name].properties,definitions).obj;
}



function newhttpobj(obj,itemName,basePath,definitions,definitions2) {
    let _obj=null;
    this.definitions=definitions;
    this._definitions=definitions2;
    this.Name="";
    this.Method="";
    this.Url="";
    this.tagName="";
    this.summary="";
    this.Request_Parameters_eg=`\n\`\`\`javascript\n\n`;
    if(obj.post){
        this.Method="POST";
        _obj=obj.post;
    }
    if(obj.get){
       this.Method="GET";
       _obj=obj.get;
    }
    if(obj.put){
        this.Method="PUT";
        _obj=obj.put;
    }
    if(obj.delete){
        this.Method="DELETE";
        _obj=obj.delete;
    }
    if(obj.patch){
        this.Method="PATCH";
        _obj=obj.patch;
    }


    if(itemName) this.Url=basePath+itemName;
     if(_obj==null) console.log(obj)
    if(_obj.tags&& _obj.tags.length) this.tagName=_obj.tags[0];
    if(_obj.summary&& _obj.summary.length) this.summary=_obj.summary;
    //  if(!_obj) console.log(obj)
    if(_obj.operationId) this.Name=_obj.operationId;
    this.Name=eutil.strReplaceAll(this.Name,"\\.","_");
    this.Request_Name_str=`* [^${this.Name}]:  ${this.summary}\n`;
    this.Request_Method_str=`\n\n[^${this.Name}]\n\n---\n\n     Name   :`+this.Name;
    this.Request_Method_str+=`\n     Method : `+this.Method;
    this.Request_Method_str+=`\n     Url    : `+this.Url;
    this.Request_Method_str+=`\n     description    : `+this.summary;
    this.Request_head="\n######Request Parameters\n"+"| name| in |type      | required  |     default     |description  |\n"
        +"| ---------- |:---------|:---------|:---------:| -----:  |----------------: |  \n";
    this.Respose_head="######Respose\n"+"| name |type      | required  |     default     |\n"
        +"| -----|:---------|:---------|:---------:|\n"
        +"| code| number | true | 2000  |\n"
        +"| msg| string | true | \"success\"  |\n"
        +"| result| object/array | true | {}/[] |\n";
    this.Respose_head+=`\n\`\`\`javascript\n\n`;
    if(_obj.parameters){
        for(let item in _obj.parameters){
            let _itemObj=_obj.parameters[item];
                let _type="object",_description="",_default="",_required="";
                if(_itemObj.type) _type=_itemObj.type;
                if(_itemObj.description && !eutil.isUndefined(_itemObj.description)) _description=_itemObj.description;
                if (haveOwnproperty(_itemObj,"default")) _default = _itemObj.default;
                if(haveOwnproperty(_itemObj,"required")) _required=_itemObj.required;
                this.Request_head+=`|${_itemObj.name}| ${_itemObj.in} |${_type}|${_required}| ${_default}| ${_description}|\n`;
                if(_itemObj.schema && _itemObj.schema['$ref'] ) {
                    var schema_obj_name=_itemObj.schema['$ref'].substr("#/definitions/".length);
                    this.forschema_obj(schema_obj_name,this._definitions);
                    this.Request_Parameters_eg+=jsonFormat(serialize_definitions(schema_obj_name,definitions))+"\n";
                    // JSON.stringify(definitions[schema_obj_name].properties)+"\n";
                }

        }
    };
    this.Respose_head+="\`\`\`\n\n";
    this.Request_Parameters_eg+="\`\`\`\n\n";
   this.resultStr=this.Request_Method_str+this.Request_head+this.Request_Parameters_eg+this.Respose_head;
   this.resultStr+="\n\n---";
}
newhttpobj.prototype.forschema_obj=function(schema_obj_name,definitions,schemaNmae){
    var _parameters= definitions[schema_obj_name].properties;
    for(let item in _parameters) {
        let _itemObj = _parameters[item];
        // if(eutil.isJsonObject(_itemObj)|| eutil.isArray(_itemObj)){
        //    if(item==="dtype") console.log("----",_parameters[item].type)
            let _type = "object", _description = "", _default = "",_required="",_schemaNmae="";
            if(schemaNmae)_schemaNmae=schemaNmae+".";
            if (_type) _type = _itemObj.type;
            if (_itemObj.description && !eutil.isUndefined(_itemObj.description)) _description = _itemObj.description;
            if (haveOwnproperty(_itemObj,"default")) _default = _itemObj.default;
            if(haveOwnproperty(_itemObj,"_required")) _required=_itemObj.required;
            this.Request_head += `|${_schemaNmae}${item}| body |${_type}|${_required}| ${_default}| ${_description}|\n`;
            // if(eutil.isUndefined(_itemObj.type)){
            //     console.log("----",_itemObj.type,_itemObj,_type)
            // }

            if (_itemObj&&_itemObj.type === "array") {
                if (_itemObj.items['$ref']) {
                    var schema_obj_name = _itemObj.items['$ref'].substr("#/definitions/".length);
                    this.forschema_obj(schema_obj_name,definitions,item);
                }
            }else
            if(_itemObj.schema && _itemObj.schema['$ref'] ) {
                var schema_obj_name = _itemObj.schema['$ref'].substr("#/definitions/".length);
                this.forschema_obj(schema_obj_name,definitions,item);
            }
        // }

    }
}
function tomd(swagger,_swagger,path) {
    let basePath=swagger.basePath;
    let paths=swagger.paths;
    let tags=swagger.tags;
// let consumes=swagger.consumes;
// let produces=swagger.produces;
    let definitions=swagger.definitions;
    let definitions2=_swagger.definitions;
    let _paths= Object.keys(paths);
    let Request_Name_str="\n";
    let tagName_str="";
    let bodyName_str="";
    let _reduce_index=0;
    let mdFilePath="";
    if(path) mdFilePath=path;
    let Request_obj = _paths.reduce((obj,item)=>{
            let _obj=new newhttpobj(paths[item],item,basePath,definitions,definitions2);
            // Request_Name_str+=_obj.Request_Name_str;
            obj.push({Request_Name_str:_obj.Request_Name_str,tagName:_obj.tagName,resultStr:_obj.resultStr});
            return obj;
        },[])

     Request_obj.reduce((obj,item)=>{
            _reduce_index++;
            if(tagName_str!==""&&tagName_str!==item.tagName){
                let r_str=Request_Name_str+bodyName_str;
                // console.log(r_str)
                fs.outputFile(`${mdFilePath}/${tagName_str}.md`, r_str, err => {  });
                tagName_str="";
                Request_Name_str="";
                bodyName_str="";
            }
             tagName_str=item.tagName;
             Request_Name_str+=item.Request_Name_str;
             bodyName_str+=item.resultStr;
           if(tagName_str!==""&&_reduce_index==Request_obj.length){
               let r_str=Request_Name_str+bodyName_str;
               // console.log(r_str)
               fs.outputFile(`${mdFilePath}/${tagName_str}.md`, r_str, err => {  });
               tagName_str="";
               Request_Name_str="";
               bodyName_str="";
           }
            return  obj;
     },"");

};



function get_swaggerObjFromUrl(url,cb) {
    request.get(url, (err, res, body) => {
        request.get(url, (err2, res2, body2) => {
            cb(err,JSON.parse(body),JSON.parse(body2));

        });

    });
}

program
    .version(pkg.version)
    .command('tomd <url> <path>')
    .description('通过swagger.json 生成md 文件')
    .action(function(url,path){
       console.log('正在准备通过 "%s" 保存到 %s', url,path);
        get_swaggerObjFromUrl(url,(err,obj,_obj)=>{
            if(err) console.error("not find swagger.json from url");
            else{
                tomd(obj,_obj,path)
            }
            // console.log(err,obj)
        })
        // console.log('Deploying "%s"', url,path,program.save_path,program.url);
    });
program.parse(process.argv);



// var url="http://10.40.253.187:3001/explorer/swagger.json";
// get_swaggerObjFromUrl(url,(err,obj,_obj)=>{
//     if(err) console.error("not find swagger.json from url");
//     else{
//         tomd(obj,Object.assign({},obj,_obj))
//     }
//     // console.log(err,obj)
// })









// 通过url获取swagger.json
// 通过 swagger.json 解析对象 获取指定文本生成 md 文件
// swagger.json -> .md -> gitbook ->  pdf  ----> 交付