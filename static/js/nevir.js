
var nevir_core = (function () {

	var nevir_conf_json = {};
	var category_conf = null;
  var networks = {
		//net0 :{"id": "net0", "nodes":[], "edges":[]}
	};
	var vis_networks = {};
	pending_calls = 0;

	/*it's a document or an author*/
	function _get_category(resource_text) {

		for (var key_cat in nevir_conf_json.categories) {
			if (nevir_conf_json.categories.hasOwnProperty(key_cat)) {
				var re = new RegExp(nevir_conf_json.categories[key_cat]["rule"]);
				if (resource_text.match(re)) {return key_cat;}
			}
		}
		return -1;
	}

	/*build a string with all the prefixes in a turtle format*/
	function _build_turtle_prefixes(){
		var turtle_prefixes = "";
		for (var i = 0; i < nevir_conf_json.prefixes.length; i++) {
			var pref_elem = nevir_conf_json.prefixes[i];
			turtle_prefixes = turtle_prefixes+" "+"PREFIX "+pref_elem["prefix"]+":<"+pref_elem["iri"]+"> ";
		}
		return turtle_prefixes;
	}

	/*build a string representing the sparql query in a turtle format*/
	function _build_turtle_query(arr_query){
		var turtle_prefixes = "";
		for (var i = 0; i < arr_query.length; i++) {
			turtle_prefixes = turtle_prefixes +" "+ arr_query[i];
		}
		return turtle_prefixes;
	}

	/*THE MAIN FUNCTION CALL
	call the sparql endpoint and do the query*/
	function do_sparql_query(resource_iri, depth=0, direction=null, query=null, replacevar=/\[\[VAR\]\]/g, cb_fun=_gen_a_node, inc_pending_calls=true){

		if (resource_iri != "") {

			var category = _get_category(resource_iri);

			//build the sparql query in turtle format
			// we first get the original node of the network
			var sparql_query = query;
			if (sparql_query == null) {
				var arr_query = nevir_conf_json.categories[category].node.query;
				sparql_query = _build_turtle_prefixes() + _build_turtle_query(arr_query);
			}

			if (replacevar != null) {
				sparql_query = sparql_query.replace(replacevar, resource_iri);
			}

			//use this url to contact the sparql_endpoint triple store
			var query_contact_tp =  String(nevir_conf_json.sparql_endpoint)+"?query="+ encodeURIComponent(sparql_query) +"&format=json";

			if (inc_pending_calls) {
				pending_calls++;
			}

			//call the sparql end point and retrieve results in json format
			$.ajax({
						dataType: "json",
						url: query_contact_tp,
						type: 'GET',
						success: function( res_data ) {
								console.log(res_data);
								if (inc_pending_calls) {
									pending_calls--;
								}
								Reflect.apply(cb_fun,undefined,[resource_iri,res_data, category, direction, depth]);
								//_build_page(res_data, category);
						}
			 });
		 }
	}

	function _build_vis_net(category) {
		var container = document.getElementById('netgraph');
		var options = {
			layout: {
					hierarchical: {
						direction: "RL"
					}
			}
		};
		vis_networks[category] = {};
		vis_networks[category]['data'] = {
			"nodes": new vis.DataSet(networks[category].nodes),
			"edges": new vis.DataSet(networks[category].edges)
		}
		network = new vis.Network(container, vis_networks[category]['data'], options);
	}

	function init_nevir(resource_iri) {

		//initialize and get the nevir_config_json
		nevir_conf_json = nevir_conf;
		var category = _get_category(resource_iri);

		networks[category] = {
			"id": category,
			"nodes":[],
			"edges":[],
			"depth":{
				"left_limit": nevir_conf_json.categories[category]["left_depth"],
				"right_limit": nevir_conf_json.categories[category]["right_depth"],
				"depths_map": {}
			}
		}
		_build_vis_net(category);

		do_sparql_query(resource_iri);
	}

	/*
	This is a call back function once we have a node to generate,
	Define the node by assigning it's info, and call a query for its edges
	*/
	function _gen_a_node(resource_iri, res_data, category, direction, depth) {
		console.log("generate a node !!");
		var bindings_res = res_data.results.bindings;
		//post sparql processing operations
		//group by
		//links
		//****//
		var postproc_res = res_data.results.bindings;

		//generate nodes
		var node_conf = nevir_conf_json.categories[category].node;
		var defined_nodes = _define_nodes(postproc_res, node_conf);
		networks[category].nodes = networks[category].nodes.concat(defined_nodes);

		//update depth nodes
		if (depth in networks[category].depth.depths_map) {
			if (networks[category].depth.depths_map[depth].indexOf(defined_nodes[0].id) == -1) {
				networks[category].depth.depths_map[depth].push([defined_nodes[0].id]);
			}
		}else {
			networks[category].depth.depths_map[depth] = [defined_nodes[0].id]
		}


		//get the connected edges in case I didn't reach limit depth
		if (postproc_res.length > 0) {
			var my_depth_limit = __get_my_depthlimit(direction);
			if (Math.abs(depth) < my_depth_limit) {
					__query_edges(resource_iri, postproc_res[0], category, direction, depth);
			}
		}

		function __get_my_depthlimit(direction){
			var my_direction_limit = null;
			switch (direction) {
				case 'right':
					my_direction_limit=networks[category].depth.right_limit;
					break;
				case 'left':
					my_direction_limit=networks[category].depth.left_limit;
					break;
				default:
					my_direction_limit=networks[category].depth.right_limit;
					if (networks[category].depth.left_limit > my_direction_limit) {
						my_direction_limit=networks[category].depth.left_limit;
					}
			}
			return my_direction_limit;
		}
		function __query_edges(resource_iri, org_node, category, direction, depth) {
			var edge_conf = nevir_conf_json.categories[category].edge;

			var var_arr = [];
			var edge_query = _build_turtle_prefixes() + _build_turtle_query(edge_conf.query);
			reg = /\[\[(.+?)\]\]/;
			while ((match = reg.exec(edge_query)) != null) {
				if (match.length > 0) {
					var arr_att = match[1].split(".");
					if (arr_att[0] == "node") {
								edge_query = edge_query.replace("[["+match[1]+"]]", org_node[arr_att[1]].value);
					}
				}
			}
			do_sparql_query(resource_iri, depth=depth, direction=direction ,query=edge_query, replacevar=null, cb_fun=_gen_the_edges);
		}
	}

	function _gen_the_edges(resource_iri, res_data, category, direction, depth) {
		//networks[category].nodes.push()
		var pure_res = res_data.results.bindings;
		var edge_conf = nevir_conf_json.categories[category].edge;
		var defined_edges = _define_edges(pure_res, edge_conf);
		networks[category].edges = networks[category].edges.concat(defined_edges);
		console.log(networks[category]);

		//recursively call for the connected nodes
		var node_conf = nevir_conf_json.categories[category].node;
		var allnodes = [];
		for (var i = 0; i < pure_res.length; i++) {

			var index_in_nodes_from = nevir_util.index_in_arrjsons(networks[category].nodes,["id"],[pure_res[i]['from'].value]);
			var index_in_nodes_to = nevir_util.index_in_arrjsons(networks[category].nodes,["id"],[pure_res[i]['to'].value]);

			//only in the init call for both connected nodes
			//otherwise call it onlt on a specific direction
			if (direction == null) {
				nevir_core.do_sparql_query(pure_res[i]['from'].value, depth=depth-1, direction='left', query=null, replacevar=/\[\[VAR\]\]/g, cb_fun = _gen_a_node);
				nevir_core.do_sparql_query(pure_res[i]['to'].value, depth=depth+1, direction='right', query=null, replacevar=/\[\[VAR\]\]/g, cb_fun = _gen_a_node);
			}else if (direction == 'left') {
				nevir_core.do_sparql_query(pure_res[i]['from'].value, depth=depth-1, direction='left', query=null, replacevar=/\[\[VAR\]\]/g, cb_fun = _gen_a_node);
			}else if (direction == 'right') {
				nevir_core.do_sparql_query(pure_res[i]['to'].value, depth=depth+1, direction='right', query=null, replacevar=/\[\[VAR\]\]/g, cb_fun = _gen_a_node);
			}
		}

	}

	function _assign_new_depth(myedge, depth, direction) {
		var left_depth = null;
		var right_depth = null;
		if (direction == 'left') {
			networks[category].depth.depths_map[depth+1].indexOf(myedge['to']);
		}
	}
	/*
	function _add_new_node(resource_iri, res_data, category, direction){
		var postproc_res = res_data.results.bindings;
		var elem_obj = postproc_res[0];
		var node_conf = nevir_conf_json.categories[category].node;

		//check if I have it id
		var node_id_conf = node_conf.id;
		var node_id = null;
		if ((node_id_conf != undefined) && (elem_obj.hasOwnProperty(node_id_conf))){
			node_id = nevir_util.getval(elem_obj[node_id_conf]);
		}

		var index_in_nodes = nevir_util.index_in_arrjsons(networks[category].nodes,["id"],[node_id]);
		if (index_in_nodes == -1) {
			var new_node = _define_nodes(postproc_res, node_conf)[0];
			networks[category].nodes.push(new_node);

			//keep recursively with others
			do_sparql_query(new_node.id);
		}
	}
	*/
	function _define_nodes(data_res, node_conf) {
		var nodes = [];
		for (var i = 0; i < data_res.length; i++) {
			var elem_obj = data_res[i];
			var new_node = {};

			//the id
			var node_id_conf = node_conf.id;
			if ((node_id_conf != undefined) && (elem_obj.hasOwnProperty(node_id_conf))){
				new_node["id"] = nevir_util.getval(elem_obj[node_id_conf]);
			}
			//the value
			var node_value_conf = node_conf.value;
			if ((node_value_conf != undefined) && (elem_obj.hasOwnProperty(node_value_conf))){
				new_node["value"] = nevir_util.getval(elem_obj[node_value_conf]);
			}
			//the label
			var node_label_conf = node_conf.label;
			new_node["label"] = nevir_util.build_lbl(elem_obj, node_conf);
			//the other fields
			var node_fields_conf = node_conf.fields;
			if (node_fields_conf != undefined){
				for (var j = 0; j < node_fields_conf.length; j++) {
					var a_field = node_fields_conf[j];
					if (a_field.hasOwnProperty("id")) {
						//var name_field = nevir_util.getval(elem_obj[a_field["value"]]);
						var name_field = nevir_util.getatt(elem_obj, a_field, "id");
						if (name_field != -1) {
							new_node[name_field] =  {};
							//add all other attributes
							for (var keyatt in a_field) {
								new_node[name_field][keyatt] = nevir_util.getatt(elem_obj, a_field, keyatt);
							}
						}
					}
				}
			}
			// add the new node
			nodes.push(new_node);
		}

		return nodes;
	}
	function _define_edges(data_res, edge_conf) {
		var edges = [];
		var edges_dic = {};
		for (var i = 0; i < data_res.length; i++) {

			var elem_obj = data_res[i];
			var new_edge = {};

			//the id
			var edge_id_conf = edge_conf.id;
			if ((edge_id_conf != undefined) && (elem_obj.hasOwnProperty(edge_id_conf))){
				new_edge["id"] = nevir_util.getval(elem_obj[edge_id_conf]);
			}

			//from
			var edge_from_conf = edge_conf.from;
			if ((edge_from_conf != undefined) && (elem_obj.hasOwnProperty(edge_from_conf))){
				new_edge["from"] = nevir_util.getval(elem_obj[edge_from_conf]);
			}

			//to
			var edge_to_conf = edge_conf.to;
			if ((edge_to_conf != undefined) && (elem_obj.hasOwnProperty(edge_to_conf))){
				new_edge["to"] = nevir_util.getval(elem_obj[edge_to_conf]);
			}

			edges.push(new_edge);
		}

		return edges;
	}

	return {
		init_nevir: init_nevir,
		do_sparql_query: do_sparql_query
	}
})();

var nevir_util = (function () {

	/*get index of obj from 'arr_objs' where
	obj['key'] (or an array of multi keys) equals val
	(or an array of multi values), it returns -1 in
	case there is no object*/
	function index_in_arrjsons(arr_objs, keys, vals){

		for (var i = 0; i < arr_objs.length; i++) {
			var elem_obj = arr_objs[i];
			var flag = true;

			for (var j = 0; j < keys.length; j++) {
				if (elem_obj.hasOwnProperty(keys[j])) {
					if (elem_obj[keys[j]].hasOwnProperty("value")) {
						flag = flag && (elem_obj[keys[j]].value == vals[j]);
					}else{
						flag = flag && (elem_obj[keys[j]] == vals[j]);
					}
				}else {
					flag = false;
				}
			}

			if (flag) {
				return i;
			}
		}
		return -1;
	}

	function getval(elem_obj) {

		if (elem_obj == undefined) { return -1;}
		if (typeof elem_obj == 'object' ) {
			if (elem_obj.hasOwnProperty("concat")) {
				//concat values
				pass;
			}else if (elem_obj.hasOwnProperty("value")) {
				return elem_obj["value"];
			}
			return "";
		}
		return elem_obj;
	}

	function getatt(elem_obj,curr_obj,att) {
		if (curr_obj.hasOwnProperty(att)) {
			var arr_att = curr_obj[att].split(".");
			if (arr_att[0] == "query") {
				return getval(elem_obj[arr_att[1]]);
			}else {
					return curr_obj[att];
			}
		}
		return -1;
	}

	function build_lbl(elem_obj, conf_obj) {
		if (conf_obj == undefined) {return -1;}
		var lbl_fields = conf_obj.fields;
		var lbl_values = conf_obj.values;
		var lbl_text = "";
		for (var j = 0; j < lbl_fields.length; j++) {
			if (lbl_fields[j] == "FREE-TEXT") {
				if ((lbl_values != undefined) && (lbl_values[j] != undefined)) {
					lbl_text = lbl_text + lbl_values[j];
				}
			}else {
				if (elem_obj.hasOwnProperty(lbl_fields[j])) {
					lbl_text = lbl_text + nevir_util.getval(elem_obj[lbl_fields[j]]);
				}
			}
		}
		return lbl_text;
	}

	/*get the value of obj[key]
	key is a string with inner keys also
	return -1 if there is no key*/
	function get_obj_key_val(obj,key){
		if (!is_undefined_key(obj,key)) {
			return _obj_composed_key_val(obj,key);
		}else {
			return -1;
		}

		function _obj_composed_key_val(obj,key_str) {
			var arr_key = key_str.split(".");
			var inner_val = obj;
			for (var i = 0; i < arr_key.length; i++) {
				inner_val = inner_val[arr_key[i]];
			}
			return inner_val;
		}
	}

	/**
 * Returns true if key is not a key in object or object[key] has
 * value undefined. If key is a dot-delimited string of key names,
 * object and its sub-objects are checked recursively.
 */
function is_undefined_key(object, key) {
	var keyChain = Array.isArray(key) ? key : key.split('.'),
			objectHasKey = keyChain[0] in object,
			keyHasValue = typeof object[keyChain[0]] !== 'undefined';

	if (objectHasKey && keyHasValue) {
			if (keyChain.length > 1) {
					return is_undefined_key(object[keyChain[0]], keyChain.slice(1));
			}

			return false;
	}
	else {
			return true;
	}
}

	return {
		index_in_arrjsons: index_in_arrjsons,
		getval: getval,
		getatt: getatt,
		build_lbl: build_lbl
	}
})();

var nevir_htmldom = (function () {
	return {
	}
})();
