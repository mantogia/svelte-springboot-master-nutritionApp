var app = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (const k in src) tar[k] = src[k];
		return tar;
	}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function create_slot(definition, ctx, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
			: ctx.$$scope.ctx;
	}

	function get_slot_changes(definition, ctx, changed, fn) {
		return definition[1]
			? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
			: ctx.$$scope.changed || {};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function set_style(node, key, value) {
		node.style.setProperty(key, value);
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	function writable(value, start = noop) {
		let stop;
		const subscribers = [];

		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (!stop) return; // not ready
				subscribers.forEach(s => s[1]());
				subscribers.forEach(s => s[0](value));
			}
		}

		function update(fn) {
			set(fn(value));
		}

		function subscribe(run, invalidate = noop) {
			const subscriber = [run, invalidate];
			subscribers.push(subscriber);
			if (subscribers.length === 1) stop = start(set) || noop;
			run(value);

			return () => {
				const index = subscribers.indexOf(subscriber);
				if (index !== -1) subscribers.splice(index, 1);
				if (subscribers.length === 0) stop();
			};
		}

		return { set, update, subscribe };
	}

	const hash = writable('');

	hashSetter();

	window.onhashchange = () => hashSetter();

	function hashSetter() {
	  hash.set(
	    location.hash.length >= 2 
	    ? location.hash.substring(2) 
	    : ''
	  );
	}

	/* src\app\component\FormComponent.svelte generated by Svelte v3.1.0 */

	const file = "src\\app\\component\\FormComponent.svelte";

	function create_fragment(ctx) {
		var h2, t1, form, div0, label0, t3, input0, t4, div1, label1, t6, input1, t7, div3, label2, t9, div2, input2, t10, div4, button, t11, dispose;

		return {
			c: function create() {
				h2 = element("h2");
				h2.textContent = "Registration Formular";
				t1 = space();
				form = element("form");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Username";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div1 = element("div");
				label1 = element("label");
				label1.textContent = "Email address";
				t6 = space();
				input1 = element("input");
				t7 = space();
				div3 = element("div");
				label2 = element("label");
				label2.textContent = "Password";
				t9 = space();
				div2 = element("div");
				input2 = element("input");
				t10 = space();
				div4 = element("div");
				button = element("button");
				t11 = text("Confirm identity");
				add_location(h2, file, 89, 0, 1619);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file, 93, 4, 1701);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "your username";
				add_location(input0, file, 94, 4, 1769);
				div0.className = "mb-3";
				add_location(div0, file, 92, 0, 1677);
				label1.htmlFor = "exampleFormControlInput1";
				label1.className = "form-label";
				add_location(label1, file, 97, 4, 1946);
				attr(input1, "type", "email");
				input1.className = "form-control";
				input1.id = "exampleFormControlInput1";
				input1.placeholder = "name@example.com";
				add_location(input1, file, 98, 4, 2030);
				div1.className = "mb-3";
				add_location(div1, file, 96, 0, 1922);
				label2.htmlFor = "inputPassword";
				label2.className = "col-sm-2 col-form-label";
				add_location(label2, file, 101, 4, 2228);
				attr(input2, "type", "password");
				input2.className = "form-control";
				input2.id = "inputPassword";
				add_location(input2, file, 103, 6, 2340);
				div2.className = "col-sm-10";
				add_location(div2, file, 102, 4, 2309);
				div3.className = "mb-3 row";
				add_location(div3, file, 100, 0, 2200);
				attr(button, "href", "#/questions");
				button.disabled = ctx.disabled;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file, 107, 4, 2515);
				div4.className = "col-auto";
				add_location(div4, file, 106, 2, 2487);
				form.className = "row g-3";
				add_location(form, file, 91, 0, 1653);

				dispose = [
					listen(input0, "input", ctx.input0_input_handler),
					listen(input0, "change", ctx.checkUsername),
					listen(input1, "input", ctx.input1_input_handler),
					listen(input1, "change", ctx.checkEmailAdress),
					listen(input2, "input", ctx.input2_input_handler),
					listen(input2, "change", ctx.checkPassword),
					listen(button, "click", ctx.saveUser)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h2, anchor);
				insert(target, t1, anchor);
				insert(target, form, anchor);
				append(form, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);

				input0.value = ctx.user.user_name;

				append(form, t4);
				append(form, div1);
				append(div1, label1);
				append(div1, t6);
				append(div1, input1);

				input1.value = ctx.user.user_email;

				append(form, t7);
				append(form, div3);
				append(div3, label2);
				append(div3, t9);
				append(div3, div2);
				append(div2, input2);

				input2.value = ctx.user.user_password;

				append(form, t10);
				append(form, div4);
				append(div4, button);
				append(button, t11);
			},

			p: function update(changed, ctx) {
				if (changed.user) input0.value = ctx.user.user_name;
				if (changed.user) input1.value = ctx.user.user_email;
				if (changed.user) input2.value = ctx.user.user_password;

				if (changed.disabled) {
					button.disabled = ctx.disabled;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h2);
					detach(t1);
					detach(form);
				}

				run_all(dispose);
			}
		};
	}

	let minLength = 4;

	function hasNumbers(t)
	  {
	  var regex = /\d/g;
	  return regex.test(t);
	}

	function instance($$self, $$props, $$invalidate) {
		let user = {
	    user_name: "",
	    user_email: "",
	    user_password: "",
	    food_ratings: []
	};


	function saveUser(){

	    console.log(user);

	    axios.post('/users', user)
	        .then((response) => {
	            console.log(response.data);
	        })
	        .catch((error) => {
	            console.log(error);
	        });
	    
	}


	let check_username = false;

	function checkUsername(){
	        if(user.user_name.length >= minLength){
	            $$invalidate('check_username', check_username = true);
	            check();
	        } else{
	            $$invalidate('check_username', check_username = false);
	        }
	    
	}

	let check_mail = false;

	function checkEmailAdress(){
	    let mail = user.user_email;
	    if(mail.length >= minLength && mail.search("@") != -1 && mail.search(".") != -1){
	        console.log("mail okey");
	        $$invalidate('check_mail', check_mail = true);
	        check();
	    } else{
	        console.log("mail bad");
	        $$invalidate('check_mail', check_mail = false);
	    }

	}

	let check_password = false;

	function checkPassword(){
	    let password = user.user_password;

	    let test = hasNumbers(password);
	    if(password.length >= minLength && test){
	        console.log("password okey");
	        $$invalidate('check_password', check_password = true);
	        check();

	    } else{
	        console.log("password bad");
	        $$invalidate('check_password', check_password = false);
	    }

	}   


	let disabled = !(check_password && check_mail && check_username);

	function check(){

	    $$invalidate('disabled', disabled = !(check_password && check_mail && check_username));
	}

		function input0_input_handler() {
			user.user_name = this.value;
			$$invalidate('user', user);
		}

		function input1_input_handler() {
			user.user_email = this.value;
			$$invalidate('user', user);
		}

		function input2_input_handler() {
			user.user_password = this.value;
			$$invalidate('user', user);
		}

		return {
			user,
			saveUser,
			checkUsername,
			checkEmailAdress,
			checkPassword,
			disabled,
			input0_input_handler,
			input1_input_handler,
			input2_input_handler
		};
	}

	class FormComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, []);
		}
	}

	/* src\app\component\LoginComponent.svelte generated by Svelte v3.1.0 */

	const file$1 = "src\\app\\component\\LoginComponent.svelte";

	function create_fragment$1(ctx) {
		var h2, t1, form, div0, label0, t3, input0, t4, div2, label1, t6, div1, input1, t7, div3, button, dispose;

		return {
			c: function create() {
				h2 = element("h2");
				h2.textContent = "Login Formular";
				t1 = space();
				form = element("form");
				div0 = element("div");
				label0 = element("label");
				label0.textContent = "Username";
				t3 = space();
				input0 = element("input");
				t4 = space();
				div2 = element("div");
				label1 = element("label");
				label1.textContent = "Password";
				t6 = space();
				div1 = element("div");
				input1 = element("input");
				t7 = space();
				div3 = element("div");
				button = element("button");
				button.textContent = "Confirm";
				add_location(h2, file$1, 70, 4, 1334);
				label0.htmlFor = "usernameInput";
				label0.className = "form-label";
				add_location(label0, file$1, 74, 8, 1425);
				attr(input0, "type", "String");
				input0.className = "form-control";
				input0.id = "usernameInput";
				input0.placeholder = "your username";
				add_location(input0, file$1, 75, 8, 1497);
				div0.className = "mb-3";
				add_location(div0, file$1, 73, 4, 1397);
				label1.htmlFor = "inputPassword";
				label1.className = "col-sm-2 col-form-label";
				add_location(label1, file$1, 78, 8, 1690);
				attr(input1, "type", "password");
				input1.className = "form-control";
				input1.id = "inputPassword";
				add_location(input1, file$1, 80, 10, 1810);
				div1.className = "col-sm-10";
				add_location(div1, file$1, 79, 8, 1775);
				div2.className = "mb-3 row";
				add_location(div2, file$1, 77, 4, 1658);
				button.disabled = true;
				button.type = "button";
				button.className = "btn btn-primary mb-3";
				add_location(button, file$1, 84, 8, 2001);
				div3.className = "col-auto";
				add_location(div3, file$1, 83, 6, 1969);
				form.className = "row g-3";
				add_location(form, file$1, 72, 4, 1369);

				dispose = [
					listen(input0, "input", ctx.input0_input_handler),
					listen(input0, "change", ctx.checkUsername),
					listen(input1, "input", ctx.input1_input_handler),
					listen(input1, "change", ctx.checkPassword),
					listen(button, "click", ctx.checkAccount)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h2, anchor);
				insert(target, t1, anchor);
				insert(target, form, anchor);
				append(form, div0);
				append(div0, label0);
				append(div0, t3);
				append(div0, input0);

				input0.value = ctx.user.user_name;

				append(form, t4);
				append(form, div2);
				append(div2, label1);
				append(div2, t6);
				append(div2, div1);
				append(div1, input1);

				input1.value = ctx.user.user_password;

				append(form, t7);
				append(form, div3);
				append(div3, button);
			},

			p: function update(changed, ctx) {
				if (changed.user) input0.value = ctx.user.user_name;
				if (changed.user) input1.value = ctx.user.user_password;
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h2);
					detach(t1);
					detach(form);
				}

				run_all(dispose);
			}
		};
	}

	let minLength$1 = 4;

	function hasNumbers$1(t)
	    {
	    var regex = /\d/g;
	    return regex.test(t);
	}

	function instance$1($$self, $$props, $$invalidate) {
		let user = {
	        user_name: "",
	        user_email: "",
	        user_password: "",
	        food_ratings: []
	    };
	    
	    
	    let check_username = false;
	    
	    function checkUsername(){
	        if(user.user_name.length >= minLength$1){
	            $$invalidate('check_username', check_username = true);
	            check();
	        } else{
	            $$invalidate('check_username', check_username = false);
	        }
	    
	    }
	    
	    
	    let check_password = false;
	    
	    function checkPassword(){
	        let password = user.user_password;
	    
	        let test = hasNumbers$1(password);
	        if(password.length >= minLength$1 && test){
	            console.log("password okey");
	            $$invalidate('check_password', check_password = true);
	            check();
	    
	        } else{
	            console.log("password bad");
	            $$invalidate('check_password', check_password = false);
	        }
	    
	    }   
	    
	    
	    let disabled = !(check_password && check_username);
	    
	    function check(){
	    
	        $$invalidate('disabled', disabled = !(check_password && check_username));
	    }
	    
	    
	    function checkAccount(){

	        axios.get("users/name/", user.user_name)
	            .then;

	        
	    }

		function input0_input_handler() {
			user.user_name = this.value;
			$$invalidate('user', user);
		}

		function input1_input_handler() {
			user.user_password = this.value;
			$$invalidate('user', user);
		}

		return {
			user,
			checkUsername,
			checkPassword,
			checkAccount,
			input0_input_handler,
			input1_input_handler
		};
	}

	class LoginComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
		}
	}

	/* src\app\pages\Homepage.svelte generated by Svelte v3.1.0 */

	const file$2 = "src\\app\\pages\\Homepage.svelte";

	// (27:0) {:else}
	function create_else_block(ctx) {
		var current;

		var logincomponent = new LoginComponent({ $$inline: true });

		return {
			c: function create() {
				logincomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(logincomponent, target, anchor);
				current = true;
			},

			i: function intro(local) {
				if (current) return;
				logincomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				logincomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				logincomponent.$destroy(detaching);
			}
		};
	}

	// (24:0) {#if neu}
	function create_if_block(ctx) {
		var current;

		var formcomponent = new FormComponent({ $$inline: true });

		return {
			c: function create() {
				formcomponent.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(formcomponent, target, anchor);
				current = true;
			},

			i: function intro(local) {
				if (current) return;
				formcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				formcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				formcomponent.$destroy(detaching);
			}
		};
	}

	function create_fragment$2(ctx) {
		var h1, t1, current_block_type_index, if_block, t2, button, t3, current, dispose;

		var if_block_creators = [
			create_if_block,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (ctx.neu) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Home sweet Home";
				t1 = space();
				if_block.c();
				t2 = space();
				button = element("button");
				t3 = text(ctx.text);
				add_location(h1, file$2, 20, 0, 344);
				button.type = "button";
				button.className = "btn btn-secondary mb-3";
				add_location(button, file$2, 32, 0, 436);
				dispose = listen(button, "click", ctx.btnHandler);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				insert(target, t1, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, t2, anchor);
				insert(target, button, anchor);
				append(button, t3);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index !== previous_block_index) {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(t2.parentNode, t2);
				}

				if (!current || changed.text) {
					set_data(t3, ctx.text);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t1);
				}

				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(t2);
					detach(button);
				}

				dispose();
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		


	  let neu = true;

	  let text = "Account exists";

	  function btnHandler(){
	  $$invalidate('neu', neu = !neu);
	  if (neu){
	    $$invalidate('text', text = "Login in existing Account");
	  }else{
	    $$invalidate('text', text = "Create new Account");
	  }
	  }

		return { neu, text, btnHandler };
	}

	class Homepage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
		}
	}

	/* src\app\pages\Notfound.svelte generated by Svelte v3.1.0 */

	const file$3 = "src\\app\\pages\\Notfound.svelte";

	function create_fragment$3(ctx) {
		var h1;

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Wrong way, go back.";
				add_location(h1, file$3, 12, 0, 184);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
				}
			}
		};
	}

	function instance$3($$self) {
		axios.get('/patients')
	    .then((response) => {
	        console.log(response.data);
	    })
	    .catch((error) => {
	        console.log(error);
	    });

		return {};
	}

	class Notfound extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, []);
		}
	}

	/* src\app\component\FoodComponent.svelte generated by Svelte v3.1.0 */

	const file$4 = "src\\app\\component\\FoodComponent.svelte";

	function create_fragment$4(ctx) {
		var div1, img, t0, div0, h5, t2, p, t3_value = ctx.food_objekt.food_name, t3, t4, button0, t6, button1, t8, button2, dispose;

		return {
			c: function create() {
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				h5 = element("h5");
				h5.textContent = "Card title";
				t2 = space();
				p = element("p");
				t3 = text(t3_value);
				t4 = space();
				button0 = element("button");
				button0.textContent = "dislike";
				t6 = space();
				button1 = element("button");
				button1.textContent = "like";
				t8 = space();
				button2 = element("button");
				button2.textContent = "superlike";
				img.src = "./images/test.jpg";
				img.className = "card-img-top svelte-14wmfk2";
				img.alt = "hier kommt das Bild hin";
				add_location(img, file$4, 19, 4, 321);
				h5.className = "card-title svelte-14wmfk2";
				add_location(h5, file$4, 21, 6, 438);
				p.className = "card-text svelte-14wmfk2";
				add_location(p, file$4, 22, 8, 486);
				button0.className = "btn btn-primary";
				add_location(button0, file$4, 25, 6, 566);
				button1.className = "btn btn-primary";
				add_location(button1, file$4, 26, 6, 653);
				button2.className = "btn btn-primary";
				add_location(button2, file$4, 27, 6, 737);
				div0.className = "card-body svelte-14wmfk2";
				add_location(div0, file$4, 20, 4, 407);
				div1.className = "card svelte-14wmfk2";
				set_style(div1, "width", "18rem");
				add_location(div1, file$4, 18, 0, 275);

				dispose = [
					listen(button0, "click", ctx.click_handler),
					listen(button1, "click", ctx.click_handler_1),
					listen(button2, "click", ctx.click_handler_2)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(div0, h5);
				append(div0, t2);
				append(div0, p);
				append(p, t3);
				append(div0, t4);
				append(div0, button0);
				append(div0, t6);
				append(div0, button1);
				append(div0, t8);
				append(div0, button2);
			},

			p: function update(changed, ctx) {
				if ((changed.food_objekt) && t3_value !== (t3_value = ctx.food_objekt.food_name)) {
					set_data(t3, t3_value);
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}

				run_all(dispose);
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		let { food_objekt } = $$props;
	    const dispatch = createEventDispatcher();


	    const handleVote = (vote) => {
	        console.log(vote);

	        dispatch('save-vote', vote);

	    };

		function click_handler() {
			return handleVote(0);
		}

		function click_handler_1() {
			return handleVote(1);
		}

		function click_handler_2() {
			return handleVote(2);
		}

		$$self.$set = $$props => {
			if ('food_objekt' in $$props) $$invalidate('food_objekt', food_objekt = $$props.food_objekt);
		};

		return {
			food_objekt,
			handleVote,
			click_handler,
			click_handler_1,
			click_handler_2
		};
	}

	class FoodComponent extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, ["food_objekt"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.food_objekt === undefined && !('food_objekt' in props)) {
				console.warn("<FoodComponent> was created without expected prop 'food_objekt'");
			}
		}

		get food_objekt() {
			throw new Error("<FoodComponent>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set food_objekt(value) {
			throw new Error("<FoodComponent>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\pages\Questionspage.svelte generated by Svelte v3.1.0 */

	const file$5 = "src\\app\\pages\\Questionspage.svelte";

	// (69:0) <FoodComponent food_objekt={food} on:save-vote={saveRelation}>
	function create_default_slot(ctx) {
		return {
			c: noop,
			m: noop,
			d: noop
		};
	}

	function create_fragment$5(ctx) {
		var h1, t_1, current;

		var foodcomponent = new FoodComponent({
			props: {
			food_objekt: ctx.food,
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		},
			$$inline: true
		});
		foodcomponent.$on("save-vote", ctx.saveRelation);

		return {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Questions";
				t_1 = space();
				foodcomponent.$$.fragment.c();
				add_location(h1, file$5, 66, 0, 1393);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, h1, anchor);
				insert(target, t_1, anchor);
				mount_component(foodcomponent, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var foodcomponent_changes = {};
				if (changed.food) foodcomponent_changes.food_objekt = ctx.food;
				if (changed.$$scope) foodcomponent_changes.$$scope = { changed, ctx };
				foodcomponent.$set(foodcomponent_changes);
			},

			i: function intro(local) {
				if (current) return;
				foodcomponent.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				foodcomponent.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(h1);
					detach(t_1);
				}

				foodcomponent.$destroy(detaching);
			}
		};
	}

	let user_id = 1;

	function instance$5($$self, $$props, $$invalidate) {
		

	    let user = {

	        user_id: 0,
	        user_name: "",
	        user_email: "",
	        user_password: "",
	        food_ratings: []

	    };


	    let food = {
	        food_id: 1,
	        food_name: "pizza",
	        category: "gerichte"
	    };

	    let foodRating = {
	        rating: 0,
	        food: 0,
	        user: 0

	    };

	    const saveRelation = (e) => {
	        
	       
	        const newVote = e.detail;
	        axios.get("/users/" + user_id)

	            .then((response) => {
	            console.log(response.data);
	            $$invalidate('user', user = response.data);
	            if(user.user_id = user_id){

	            foodRating.user = user; $$invalidate('user', user); $$invalidate('foodRating', foodRating);
	            foodRating.food = food; $$invalidate('foodRating', foodRating);
	            foodRating.rating = newVote; $$invalidate('foodRating', foodRating);

	            console.log(foodRating);
	            save();
	            }
	            })
	            .catch((error) => {
	                        console.log(error);
	            });
	    };

	    const save = () =>{
	        axios.post("/food_ratings/"+ foodRating.user.user_id+"/"+foodRating.food.food_id+"/"+foodRating.rating)
	            .then((response) => {
	            console.log(response.data);
	            })
	            .catch((error) => {
	                console.log(error);
	            });
	    };

		return { food, saveRelation };
	}

	class Questionspage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
		}
	}

	/* src\app\routing\Router.svelte generated by Svelte v3.1.0 */

	const file$6 = "src\\app\\routing\\Router.svelte";

	function create_fragment$6(ctx) {
		var main, current;

		var switch_value = ctx.value;

		function switch_props(ctx) {
			return { $$inline: true };
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		return {
			c: function create() {
				main = element("main");
				if (switch_instance) switch_instance.$$.fragment.c();
				main.className = "svelte-1arjn8m";
				add_location(main, file$6, 31, 0, 631);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, main, anchor);

				if (switch_instance) {
					mount_component(switch_instance, main, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (switch_value !== (switch_value = ctx.value)) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;
						on_outro(() => {
							old_component.$destroy();
						});
						old_component.$$.fragment.o(1);
						check_outros();
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));

						switch_instance.$$.fragment.c();
						switch_instance.$$.fragment.i(1);
						mount_component(switch_instance, main, null);
					} else {
						switch_instance = null;
					}
				}
			},

			i: function intro(local) {
				if (current) return;
				if (switch_instance) switch_instance.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				if (switch_instance) switch_instance.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(main);
				}

				if (switch_instance) switch_instance.$destroy();
			}
		};
	}

	function instance$6($$self, $$props, $$invalidate) {
		

	  let value = Notfound;

	  hash.subscribe( valu => {
	    switch(valu) {
	      case '':
	        $$invalidate('value', value = Homepage);
	        break;
	        case 'questions':
	        $$invalidate('value', value = Questionspage);
	        break;
	      default:
	        $$invalidate('value', value = Notfound);
	    }
	  });

		return { value };
	}

	class Router extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$6, safe_not_equal, []);
		}
	}

	/* src\app\component\RouterLink.svelte generated by Svelte v3.1.0 */

	const file$7 = "src\\app\\component\\RouterLink.svelte";

	function create_fragment$7(ctx) {
		var a, a_href_value, current;

		const default_slot_1 = ctx.$$slots.default;
		const default_slot = create_slot(default_slot_1, ctx, null);

		return {
			c: function create() {
				a = element("a");

				if (default_slot) default_slot.c();

				a.href = a_href_value = "#/" + ctx.url;
				a.className = "svelte-1b10eml";
				add_location(a, file$7, 10, 0, 102);
			},

			l: function claim(nodes) {
				if (default_slot) default_slot.l(a_nodes);
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);

				if (default_slot) {
					default_slot.m(a, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (default_slot && default_slot.p && changed.$$scope) {
					default_slot.p(get_slot_changes(default_slot_1, ctx, changed,), get_slot_context(default_slot_1, ctx, null));
				}

				if ((!current || changed.url) && a_href_value !== (a_href_value = "#/" + ctx.url)) {
					a.href = a_href_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				if (default_slot && default_slot.i) default_slot.i(local);
				current = true;
			},

			o: function outro(local) {
				if (default_slot && default_slot.o) default_slot.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(a);
				}

				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance$7($$self, $$props, $$invalidate) {
		let { url } = $$props;

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ('url' in $$props) $$invalidate('url', url = $$props.url);
			if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
		};

		return { url, $$slots, $$scope };
	}

	class RouterLink extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$7, create_fragment$7, safe_not_equal, ["url"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.url === undefined && !('url' in props)) {
				console.warn("<RouterLink> was created without expected prop 'url'");
			}
		}

		get url() {
			throw new Error("<RouterLink>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set url(value) {
			throw new Error("<RouterLink>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\app\component\Sidenav.svelte generated by Svelte v3.1.0 */

	const file$8 = "src\\app\\component\\Sidenav.svelte";

	// (26:6) <RouterLink url=''>
	function create_default_slot_2(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Homepage");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (29:6) <RouterLink url='asas'>
	function create_default_slot_1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("WrongPage");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (33:6) <RouterLink url='questions'>
	function create_default_slot$1(ctx) {
		var t;

		return {
			c: function create() {
				t = text("Survey");
			},

			m: function mount(target, anchor) {
				insert(target, t, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$8(ctx) {
		var nav, h1, t1, ul, li0, t2, li1, t3, li2, current;

		var routerlink0 = new RouterLink({
			props: {
			url: "",
			$$slots: { default: [create_default_slot_2] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var routerlink1 = new RouterLink({
			props: {
			url: "asas",
			$$slots: { default: [create_default_slot_1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		var routerlink2 = new RouterLink({
			props: {
			url: "questions",
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		},
			$$inline: true
		});

		return {
			c: function create() {
				nav = element("nav");
				h1 = element("h1");
				h1.textContent = "Sidenav";
				t1 = space();
				ul = element("ul");
				li0 = element("li");
				routerlink0.$$.fragment.c();
				t2 = space();
				li1 = element("li");
				routerlink1.$$.fragment.c();
				t3 = space();
				li2 = element("li");
				routerlink2.$$.fragment.c();
				add_location(h1, file$8, 22, 2, 305);
				li0.className = "svelte-z3uaim";
				add_location(li0, file$8, 24, 4, 333);
				li1.className = "svelte-z3uaim";
				add_location(li1, file$8, 27, 4, 399);
				li2.className = "svelte-z3uaim";
				add_location(li2, file$8, 31, 4, 471);
				ul.className = "svelte-z3uaim";
				add_location(ul, file$8, 23, 2, 324);
				nav.className = "svelte-z3uaim";
				add_location(nav, file$8, 21, 0, 297);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, nav, anchor);
				append(nav, h1);
				append(nav, t1);
				append(nav, ul);
				append(ul, li0);
				mount_component(routerlink0, li0, null);
				append(ul, t2);
				append(ul, li1);
				mount_component(routerlink1, li1, null);
				append(ul, t3);
				append(ul, li2);
				mount_component(routerlink2, li2, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var routerlink0_changes = {};
				if (changed.$$scope) routerlink0_changes.$$scope = { changed, ctx };
				routerlink0.$set(routerlink0_changes);

				var routerlink1_changes = {};
				if (changed.$$scope) routerlink1_changes.$$scope = { changed, ctx };
				routerlink1.$set(routerlink1_changes);

				var routerlink2_changes = {};
				if (changed.$$scope) routerlink2_changes.$$scope = { changed, ctx };
				routerlink2.$set(routerlink2_changes);
			},

			i: function intro(local) {
				if (current) return;
				routerlink0.$$.fragment.i(local);

				routerlink1.$$.fragment.i(local);

				routerlink2.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				routerlink0.$$.fragment.o(local);
				routerlink1.$$.fragment.o(local);
				routerlink2.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(nav);
				}

				routerlink0.$destroy();

				routerlink1.$destroy();

				routerlink2.$destroy();
			}
		};
	}

	class Sidenav extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$8, safe_not_equal, []);
		}
	}

	/* src\App.svelte generated by Svelte v3.1.0 */

	const file$9 = "src\\App.svelte";

	function create_fragment$9(ctx) {
		var div, t, current;

		var sidenav = new Sidenav({
			props: { class: "sidenav" },
			$$inline: true
		});

		var router = new Router({ $$inline: true });

		return {
			c: function create() {
				div = element("div");
				sidenav.$$.fragment.c();
				t = space();
				router.$$.fragment.c();
				div.className = "app-shell svelte-h5712t";
				add_location(div, file$9, 16, 0, 260);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(sidenav, div, null);
				append(div, t);
				mount_component(router, div, null);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				sidenav.$$.fragment.i(local);

				router.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				sidenav.$$.fragment.o(local);
				router.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				sidenav.$destroy();

				router.$destroy();
			}
		};
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$9, safe_not_equal, []);
		}
	}

	const app = new App({
		target: document.body.querySelector('#app')
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
