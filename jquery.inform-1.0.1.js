/*
 * jQuery inform plugin
 * 
 * Copyright (c) 2011 Jonathan Bingham (jbingham.com)
 * https://github.com/jbingham/jquery-inform-plugin
 * 
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
(function($) {
	// Default settings for the inform plugin.
	var defaults = {
		ajax: null, // jQuery.ajax options for form submission.
			// Tip: you quite likely want to set these.
		change: fieldEdited, // function($field, isEdited), called on change. 
			// Tip: you probably don't want to change this.
		edit: null, // function($field, isFieldEdited, isFormEdited) 
			// called by the change function. Tip: maybe you want to set this. 
		errorMessage: null, // A function($form, xhr, status, err), string, or null.
			// Used to display a dialog to the user after a form submission error.
		errorTitle: 'Error', // jquery-ui dialog title on error.
		reset: resetForm, // Function to call to reset the form.
		submit: submitForm, // Function to call to submit the form.
			// Tip: the 'ajax' option is probably all you need.
		successMessage: null, // A function($form, data), string, or null.
			// Used to display a dialog to the user after submitting the form.
		successTitle: 'Success', // jquery-ui dialog title on success.
		wrapEvents: true, // Wrap jquery.ajax success and error functions.
			// This will enable/disable buttons based on ajax success or failure.
		undoEdit: true // Disable buttons if user undoes their editing.
	};	
	
	// Plugin methods, called using $(form).inform('method', options);
	var methods = {
			
		// Initialize a inform.
		init: function(options) {			
			return this.each(function() {
				var $form = $(this).addClass('ui-inform'),
					settings = $form.data('inform');

				if (!settings) {
					settings = $.extend({}, defaults);
					if (options)
						$.extend(settings, options);					

					var edited = function(e) {
				        var isEdited = e.target && isFieldEdited($(e.target));
				        if (settings.change && $.isFunction(settings.change)) 
				        	settings.change.apply($form, [e.target, isEdited]);		
					};					
			        $form.find("select,input[type='checkbox'],input[type='radio']")
			        	.bind('change.inform', edited);
			        $form.find("input,textarea")
			        	.not("input[type='checkbox'],input[type='radio']")
			        	.bind('keyup.inform', edited);
			        
		        	if (settings.submit && $.isFunction(settings.submit)) 
		        		$form.submit(settings.submit);			        
		        	if (settings.reset && $.isFunction(settings.reset))
		        		$form.find(':reset').bind('click', settings.reset);

					$form.data('inform', settings);
                    formEdited($form, false);
                    
				} else if (options) {
					$.extend(settings, options);					
					$form.data('inform', settings);
				}
			});
		},
		
		// Set the inform plugin's default settings.
		defaults: function(options) {
			if (options)
				defaults = $.extend(defaults, options);
		},
		
		// Set the form data.
		data: function(data) {
			if (data) {
				return this.each(function(){
					var $form = $(this), key;
			        for (key in data) {
			            $form.find('name=[' + key + ']').each(function() {
			                var $el = $(this);
			                if (data[key] && $el.attr('nodeName') == 'SELECT' &&
			                      !$el.find("option[value='" + key + "'").length)
			                    $el.html('<option value="' + data[key] + '" selected>' +
			                        data[key] + '</option>');
			                else if (data[key])
			                    $el.val(data[key]);
			                //else
			                //    $el.val(null); // in IE8, sets to text 'null'!
			            });
			        }	
				});
			} else {
		        var data = {}, $form = $(this);
		        $form.find(':input').each(function() {
		        	data[$(this).attr('name')] = getFormValue($(this));
		        });
		        return data;				
			}
		},

		// Check if the form has been edited.
        edited: function() {
            return isFormEdited($(this));
        },
		
        // Enable or disable the form. 
		enabled: function(isEnabled) {
			return this.each(function(){
				var $form = $(this);
				
				if (isEnabled) {
				    $form.find("input,textarea,select")
			        	.not("input[type='checkbox'],input[type='radio']")
			    		.filter(':not(.ui-inform-locked)')
			    		.attr('readonly', false)
			    		.removeClass('ui-inform-readonly');
			        $form.find("input[type='checkbox'],input[type='radio'],select")
		            	.filter(':not(.ui-inform-locked)')
		            	.removeAttr('disabled')
		            	.removeClass('ui-state-disabled');
				} else {
					$form.find("input,textarea,select")
			        	.not("input[type='checkbox'],input[type='radio']")
						.filter(':not(.ui-inform-locked)')
						.attr('readonly', true)
						.addClass('ui-inform-readonly');				
			        $form.find("input[type='checkbox'],input[type='radio'],select")
		            	.filter(':not(.ui-inform-locked)')
		            	.attr('disabled', true)
		            	.addClass('ui-state-disabled');
				}
				$form.find('select.ui-inform-locked.ui-inform-readonly option:not(:selected)').hide();
			});
		},
		
		// Make the current form data the default values.
		apply: function() {
			return this.each(function(){
				var $form = $(this);
		        $form.find(':input').each(function() {
                    var $field = $(this),
		            	key = $field.attr('type') == 'checkbox' ? 'defaultChecked' : 'defaultValue',
		            	val = $field.attr('type') == 'checkbox' || $field.attr('type') == 'radio' 
	                        ? ($field.attr('checked') ? $field.val() : false) 
	                        : $field.val();
		            $(this).attr(key, val);
		        });
                formEdited($form, false);
			});
		},
		
		// Load form data using an ajax call. 
		// Make the loaded data the form defaults.
		load: function(options) {
			this.css('cursor', 'wait');
			
			return this.each(function(){
				var $form = $(this),
					settings = this.data('inform'),
					opts = {
		                method: 'GET',
		                url: $form.attr('action'),
		                success: methods.data
			        },
			        s, e;
				
		    	methods.enabled.apply($form, [false]); 
		    	formEdited($form, false); 
		    	
	        	if (options) 
	        		opts = $.extend(opts, options);
	        	
	        	if (settings.wrapEvents) {
	        		s = opts.success;
	        		e = opts.error;
	    	    	opts = $.extend(opts, {
	    	            success: function(data) {
	    	            	$form.css('cursor', 'default');
	    	                methods.apply.apply($form, []);
	    	            	methods.enabled.apply($form, [true]);
	    	            	if (s && $.isFunction(s)) 
	    	            		s.apply($form, [data]);
	    	            },
	    	            error: function(xhr, status, err) {
	    	            	$form.css('cursor', 'default');
	    	            	methods.enabled.apply($form, [true]);
	    	            	if (e && $.isFunction(e)) {
	    	            		e.apply($form, [xhr, status, err]);
	    	            	} else if ($.dialog) {
	    	            		$('#smrtform_dialog').remove();
    	            			$('body').append('<div id="smrtform_dialog" title="' 
    	            				+ settings.errorTitle +'"><p>' 
    	            				+ getErrorMessage($form, xhr, status, err) 
    	            				+'</p></div>');
	    	            		$('#smrtform_dialog').dialog();
	    	            	} else {
	    	            		alert(getErrorMessage($form, xhr, status, err));
	    	            	}
	    	            }
	    	    	});
	        	}	        		   
	        	$.ajax( opts );				
		    });
		},
		
		// Cleanup all events, data and css classes.
		destroy: function() {
			return this.each(function(){
				var $form = $(this);
		        $form.find(':input').unbind('.inform');		        
				$form.removeData('inform').removeClass('ui-inform');
		    });
		}		
	};
		
	// Call a inform method.
	$.fn.inform = function(method) {
		if (methods[method])
			return methods[method].apply( 
					this, Array.prototype.slice.call( arguments, 1 ));
		else if ( typeof method === 'object' || ! method )
			return methods.init.apply( this, arguments );
		else
			$.error( 'Method ' +  method + ' does not exist on jQuery.inform' );		
	};
	
	// Get a message for successful form submission. 
	function getSuccessMessage($form, data) {
		var settings = $form.data('inform');
		if (!settings.successMessage)
			return data;
		if ($.isFunction(settings.successMessage))
			return settings.successMessage.apply(this, [xhr, status, err]);
		return settings.successMessage;
	}
	
	// Get an error message from the response.
	function getErrorMessage($form, xhr, status, err) {
		var settings = $form.data('inform');
		if (!settings.errorMessage)
			return 'Error! ' + err;
		if ($.isFunction(settings.errorMessage))
			return settings.errorMessage.apply(this, [xhr, status, err]);
		return settings.errorMessage;
	}	
	
	// Test if the form has changed from its default values.
    function isFormEdited($form) {
        var isEdited = false;
        $form.find('select,input,textarea').each(function() {
            if (isFieldEdited($(this))) {
                isEdited = true;
                return false;
            }
        });
        return isEdited;
    }
    
    // Test if a form field has changed from its default value.
    function isFieldEdited($formField) {
        var val = getFormValue($formField),
        	def = $formField.attr('type') == 'checkbox' 
	                || $formField.attr('type') == 'radio' 
	            ? ($formField.attr('defaultChecked') ? $formField.val() : false) 
	            : $formField.attr('defaultValue'),
            isEdited = (val != def) && (val || def)
	            && !((val === undefined || val == 'undefined') 
	                && (def === undefined || def == 'undefined'));
        return isEdited;
    }

    // Get the value for a form field.
    function getFormValue($formField) {
        return $formField.attr('type') == 'checkbox' 
        		|| $formField.attr('type') == 'radio' 
        	? ($formField.attr('checked') ? $formField.val() : false) 
        	: $formField.val();
    }	
    
    // The form as a whole has been edited or reverted.
    function formEdited($form, isEdited) {
    	if (isEdited) {
    		$form.find(':submit,:reset').removeAttr('disabled')
    			.removeClass('ui-state-disabled');
    	} else if ($form.data('inform').undoEdit) {
    		$form.find(':submit,:reset').attr('disabled', true)
    			.addClass('ui-state-disabled');
    	}
    }
    
    // The field has been edited or reverted.
    function fieldEdited($field, isEdited) {
		var settings = $form.data('inform'),
			isFormEdited = isFormEdited($(this));
        //alert('fieldEdited: ' + isEdited);
    	formEdited(this, isFormEdited); 

    	if (settings.edit && $.isFunction(settings.edit)) 
        	settings.edit.apply(this, [$field, isEdited, isFormEdited]);		
    }
    
    // Update the form defaults to their current values.
    function resetForm(e) {    	
    	$form = $(this).closest('form');
    	$form.each(function() {
    		this.reset();
            methods.apply.apply($form, []);
    	});
        formEdited($form, false);
        return false;
    }    
    
    // Submit the form, blocking input while waiting.
    function submitForm(e) {
    	var $form = $(this).css('cursor', 'wait'),
			settings = $form.data('inform'),
    		opts = {
                type: $form.attr('method'),
                url: $form.attr('action'),
                data: methods.data.apply($form, [])
        	},
        	s, e;
        	
        if (!settings.ajax) 
            return true;
    	
    	// Disable while submitting
    	methods.enabled.apply($form, [false]); 
    	formEdited($form, false); 

    	if (settings.ajax) 
    		$.extend(opts, settings.ajax);
    	
    	if (settings.wrapEvents) {
    		s = opts.success;
    		e = opts.error;
	    	$.extend(opts, {
	            success: function(data) {
	            	$form.css('cursor', 'default');
	                methods.apply.apply($form, []);
	            	methods.enabled.apply($form, [true]);
	            	if (s && $.isFunction(s)) {
	            		s.apply($form, [data]);
	            	} else if ($.fn.dialog) {
	            		$('#ui-inform-dialog').remove();
            			$('body').append('<div id="ui-inform-dialog" title="' 
            				+ settings.successTitle +'"><p>' 
            				+ getSuccessMessage($form, data) + '</p></div>');
	            		$('#ui-inform-dialog').dialog();
	            	} else {
	            		alert(getSuccessMessage($form, data));
	            	}
	            },
	            error: function(xhr, status, err) {
	            	$form.css('cursor', 'default');
	            	methods.enabled.apply($form, [true]);
	            	formEdited($form, true);
	            	if (e && $.isFunction(e)) {
	            		e.apply($form, [xhr, status, err]);
	            	} else if ($.fn.dialog) {
	            		$('#smrtform_dialog').remove();
            			$('body').append('<div id="ui-inform-dialog" title="' 
            				+ settings.errorTitle +'"><p>' 
            				+ getErrorMessage($form, xhr, status, err) 
            				+'</p></div>');
	            		$('#ui-inform-dialog').dialog();
	            	} else {
	            		alert(getErrorMessage($form, xhr, status, err));
	            	}
	            }
	    	});
    	}       	
    	$.ajax( opts );
    	return false;
    }       
})(jQuery);
